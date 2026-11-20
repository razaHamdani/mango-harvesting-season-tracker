# PLAN: P3 — Enforce data-integrity rules in Postgres

> Supersedes the PLAN.md approved 2026-11-20, which had three phases:
> - P2, the test-DB guard: done, merged as #25.
> - P1, CI credential isolation: dropped by the owner on 2026-11-20 ("we are
>   NOT doing it"). The repo-level secrets and the current
>   approve-then-migrate flow stay as they are.
> - P3: this plan. Same design as before, with the plan review's fixes
>   folded in, and moved onto the current CI flow.
>
> Status: DRAFT — awaiting owner approval.

## Goal

Postgres itself enforces three rules the app enforces today only in its own
code. A user's session token used directly against the REST API can
currently bypass all three:

1. A closed season's records cannot change.
2. A season can only use farms and workers owned by the same user.
3. Nobody can make themselves `admin`.

## Facts this plan rests on (verified 2026-11-20)

- **Closed seasons in the app:**
  - The app treats a closed season as fully frozen.
  - Create and payment require `status = 'active'`
    (`src/lib/utils/season-date-guard.ts:27`).
  - Deletes refuse closed seasons (`activity-actions.ts:127`,
    `expense-actions.ts:165`).
  - A closed season can still be deleted whole (`season-actions.ts:123`).
  - `closeSeason` is a compare-and-set UPDATE (`season-actions.ts:299-304`).
- **Child-table RLS:**
  - There is one permissive FOR ALL policy per table.
  - `season_farms` WITH CHECK checks only season ownership
    (`20260426000002_rls_exists_rewrite.sql:20-35`).
  - `expenses.worker_id` has no ownership check.
- **Profiles:**
  - `handle_new_user` copies `role` from signup metadata
    (`20260420000000_add_profiles_role.sql:26`).
  - `prevent_role_self_edit` guards UPDATE only.
  - The FOR ALL profiles policy (`initial_schema:127`) lets a user DELETE
    their row and INSERT it again with `role = 'admin'`.
  - `ensureProfile` sends `role` from `user_metadata`, which the user
    controls (`profile-queries.ts:18`).
  - The app only offers `landlord` (`auth-actions.ts:9`).
- **`admin` grants nothing in the database.** No policy or function reads
  `profiles.role`. It is an app label, not a Postgres role.
- **Foreign keys:**
  - `expenses.worker_id` is `ON DELETE SET NULL`, which runs as an UPDATE on
    `expenses`.
  - Workers can be deactivated (`toggleWorkerActive`).
- **Function security:**
  - `create_season_with_children` is `SECURITY INVOKER`
    (`20261114120000:199`), so RLS applies to it.
  - The date-range trigger rejects `paid_date > end_date`
    (`20261114120000:108-110`).
- **Migration lint** (`scripts/check-migrations.mjs`):
  - no `BEGIN`/`COMMIT` in new files;
  - `DROP FUNCTION/TABLE/…` needs `-- safety: allow-destructive <reason>`;
  - `DROP POLICY` and `DROP TRIGGER` are allowed.
- **CI on merge to `main`** (#26): lint, tests and build are skipped. Then:
  - `Check pending production migrations` (dry run);
  - `Approve production migrations (within 1h)`;
  - `Migrate production DB`.

## Decisions

- **D6** In the DB, a closed season is fully frozen:
  - no INSERT, UPDATE or DELETE on `activities`, `expenses`, `installments`
    or `season_farms`;
  - no UPDATE of the closed `seasons` row;
  - deleting the whole season stays allowed.

  This mirrors the app. Recording a payment after close would be a new
  feature and is not part of this plan.
- **D7** `paid_date` may fall after the season's `end_date`, in both the DB
  trigger and the app guard. It must still be on or after `start_date`.
  `due_date` keeps both bounds. (Owner's choice.)
- **D8** Deleting a worker who has salary in a closed season is refused with
  a plain message. Deactivating the worker stays available. (Product agent,
  accepted.)
- **D9** The closed-season trigger raises SQLSTATE `55000` ("season is
  closed"). Server actions map that code to "This season is closed." instead
  of a generic failure.

## Before any code: owner steps (read-only, production)

Run these in the Supabase SQL Editor on production. Send me only the results
shown; no emails or ids.

```sql
-- A. roles in use
select role, count(*) from public.profiles group by role;

-- B. cross-owner farm links (expect 0)
select count(*) from public.season_farms sf
join public.seasons s on s.id = sf.season_id
join public.farms f on f.id = sf.farm_id
where f.owner_id <> s.owner_id;

-- C. cross-owner worker links (expect 0)
select count(*) from public.expenses e
join public.seasons s on s.id = e.season_id
join public.workers w on w.id = e.worker_id
where w.owner_id <> s.owner_id;

-- D. table owners (expect all postgres)
select tablename, tableowner from pg_tables where schemaname = 'public';

-- E. forced RLS (expect no public tables)
select relname from pg_class
where relforcerowsecurity and relnamespace = 'public'::regnamespace;
```

What stops the work:
- **B or C > 0:** stop. We decide together what to do with those rows. The
  new policies do not check existing rows.
- **D not all `postgres`, or E not empty:** stop. The closed-season trigger
  depends on both.
- **A shows `admin` or `contractor` rows:** you review those accounts. Any
  demotion is a separate UPDATE that you confirm explicitly. Because the
  role guard blocks sessions without a JWT, it runs as:
  ```sql
  begin;
  alter table public.profiles disable trigger profiles_guard_role;
  update public.profiles set role = 'landlord' where id = '<id>';
  alter table public.profiles enable trigger profiles_guard_role;
  commit;
  ```
  The migrations change no existing role.

## Work: one branch `db-integrity`, one PR, three commits

Each commit has its own local gate:
- `npx supabase db reset`;
- `npm test`, `npx tsc --noEmit`, `npm run lint`;
- `node scripts/check-migrations.mjs`.

Each migration ends with a `-- ROLLBACK:` comment block in the repo's style
(`20260504120000:44-55`).

### P3a — `20261120120000_closed_season_frozen.sql`

1. New function `public.enforce_closed_season()`:
   - Settings: plpgsql, `SECURITY DEFINER`, `SET search_path = public`.
     Owner `postgres` owns the tables, and RLS is not forced, so its reads
     bypass RLS. A season hidden from the caller is still found, and "not
     found" only ever means "deleted".
   - Season ids:
     - INSERT uses NEW.season_id;
     - DELETE uses OLD.season_id;
     - UPDATE uses OLD and NEW when they differ, so both the source and the
       destination are checked.
   - Lock: `SELECT id, status FROM seasons WHERE id = ANY(ids) ORDER BY id
     FOR SHARE`.
     - It conflicts with the row lock taken by `closeSeason`'s UPDATE, so a
       write and a close on the same season run one after the other.
     - Under READ COMMITTED, a writer that waited re-reads the committed
       status.
     - `ORDER BY id` gives a fixed lock order, which avoids deadlocks.
   - Any season `closed` → `RAISE EXCEPTION 'season is closed' USING ERRCODE
     = '55000'`.
   - A season not found → allow. The FK guarantees the season exists unless
     it was deleted earlier in the same transaction, which is the
     `ON DELETE CASCADE` of a season delete.
   - No `pg_trigger_depth()` shortcut, and no "skip if another trigger is
     running".
2. BEFORE INSERT OR UPDATE OR DELETE FOR EACH ROW triggers on
   `activities`, `expenses`, `installments` and `season_farms`.
3. New function `public.enforce_closed_season_row()`, a BEFORE UPDATE
   trigger on `seasons`. If OLD.status is `closed`, the update is rejected
   with `55000`. DELETE is unaffected.
4. `CREATE OR REPLACE public.enforce_season_date_range()` with the same body
   except that the `paid_date > v_end` check is removed (D7).
5. App:
   - `assertWithinSeasonWindow(supabase, seasonId, date, { allowAfterEnd })`:
     only `recordPayment` passes `allowAfterEnd: true`.
   - `deleteWorker`: before deleting, count the worker's expenses in
     closed seasons. If there are any, return "This worker has salary in a
     closed season and can't be deleted. Deactivate them instead."
   - The `55000` mapping (D9) goes in `createActivity`, `deleteActivity`,
     `createExpense`, `deleteExpense`, `recordPayment` and `deleteWorker`.
6. **Rollback** (forward migration):
   - `DROP TRIGGER` on the five triggers;
   - `DROP FUNCTION` on the two new functions, marked
     `-- safety: allow-destructive rollback`;
   - `CREATE OR REPLACE` `enforce_season_date_range` with the upper bound
     back;
   - revert the app commit.

### P3b — `20261120120100_owner_bound_references.sql`

1. Add RESTRICTIVE policies. They are ANDed with every permissive policy, so
   a later permissive policy cannot bypass them:
   - `season_farms`, FOR INSERT: `WITH CHECK (EXISTS (SELECT 1 FROM farms f
     WHERE f.id = farm_id AND f.owner_id = auth.uid()))`.
   - `season_farms`, FOR UPDATE: `USING (true)`, with the same WITH CHECK.
   - `expenses`, FOR INSERT and FOR UPDATE: `WITH CHECK (worker_id IS NULL
     OR EXISTS (SELECT 1 FROM workers w WHERE w.id = worker_id AND
     w.owner_id = auth.uid()))`.
2. `create_season_with_children` (SECURITY INVOKER) becomes subject to these
   too. Its callers own their farms, so it is unaffected.
3. **Rollback**: `DROP POLICY` on the four restrictive policies.

### P3c — `20261120120200_profile_role_lockdown.sql`

1. `CREATE OR REPLACE public.handle_new_user()`: role is always
   `'landlord'`. The metadata role is ignored.
2. Drop the FOR ALL profiles policy and create:
   - `SELECT` USING `id = auth.uid()`;
   - `UPDATE` USING and WITH CHECK `id = auth.uid()`;
   - `INSERT` WITH CHECK `id = auth.uid() AND role = 'landlord'`, which keeps
     `ensureProfile`'s upsert working;
   - no DELETE policy. Rows go only through the `auth.users` cascade.
3. Column privileges:
   - `REVOKE UPDATE ON public.profiles FROM anon, authenticated;`
   - `GRANT UPDATE (full_name, phone, updated_at) ON public.profiles TO
     authenticated;`
   - Before writing it, check this list against every app write to
     `profiles`. Today the only write is `ensureProfile`'s insert-or-ignore.
   - `prevent_role_self_edit` stays as a second layer.
4. App: `ensureProfile` stops sending `role`, so the column default
   (`landlord`) applies.
5. **Rollback**:
   - re-create the FOR ALL policy;
   - `GRANT UPDATE ON public.profiles TO authenticated`;
   - restore the previous `handle_new_user` body;
   - revert the app commit.

## Tests

New `tests/db-integrity.test.ts`, run against the local DB. Fixture rule: the
trigger fires for `service_role` too, so seed children first and close the
season afterwards.

Closed season:
- As the owner's client, each of these fails with `55000` and leaves the row
  unchanged:
  - INSERT, UPDATE and DELETE on activities, expenses and installments;
  - INSERT and DELETE on season_farms;
  - UPDATE of the season row.
- Moving an expense from an active season to a closed one fails, and so
  does moving one from a closed season to an active one.
- Deleting a closed season with children succeeds, and the children are
  gone.
- An active season accepts the same writes.
- Race, made deterministic with two `pg` connections:
  - (a) Connection 2 runs `BEGIN; UPDATE seasons SET status='closed'`. An
    INSERT on connection 1 blocks. Connection 2 commits, and connection 1
    fails with `55000`.
  - (b) Connection 1 has an open INSERT transaction. Connection 2's close
    waits until connection 1 commits.
- A `paid_date` after `end_date` is accepted; one before `start_date` is
  rejected.
- `deleteWorker` with salary in a closed season returns the message, and the
  worker survives.

Ownership (user B against user A):
- Linking A's farm to B's season (INSERT) fails.
- Re-pointing B's `season_farms` row to A's farm (UPDATE) fails.
- Using A's `worker_id` on B's expense fails, on INSERT and on UPDATE.
- Policy inventory: a snapshot of `pg_policies` for `season_farms`,
  `expenses`, `activities`, `installments` and `profiles`. Any new policy
  fails the test until the snapshot is updated on purpose.

Profiles:
- `signUp` with `{ data: { role: 'admin' } }` gives a `landlord` profile.
- A user cannot DELETE their profile, and cannot INSERT one with
  `role = 'admin'`.
- A user's UPDATE of `role` fails with `42501`, because of the column
  privilege.
- Trigger layer, with raw `pg` in one transaction:
  - `SET LOCAL ROLE authenticated`;
  - set `request.jwt.claims`;
  - temporarily `GRANT UPDATE (role)`;
  - the UPDATE fails with "role can only be changed by admin/service";
  - `ROLLBACK`.
- A user with `role = 'admin'`, set by the service role, cannot read another
  user's farms.

Existing tests changed on purpose:
- `season-date-range.test.ts:268-271`, "rejects a payment dated after
  end_date", is inverted.
- `profiles.test.ts:89-97` expects `42501` instead of the trigger message.

These stay green unchanged: `closed-season-immutability.test.ts`,
`seasons.test.ts`, `expenses.test.ts`, `audit.test.ts`, `auth.test.ts`.

## Release

1. **PR**: CI must be green. Lint, the migration lint, tests and build run
   on PRs.
2. **You, before merging**:
   - confirm a fresh Supabase backup, or that PITR is on;
   - make sure the read-only checks above were clean.
3. **Merge.**
   - `Check pending production migrations` must list exactly the three new
     files. If it lists anything else, reject the approval.
4. **Approve** `Approve production migrations (within 1h)` within the hour,
   then `Migrate production DB` runs.
5. **Smoke check in production**:
   - closing a test season, then trying to add an expense in the UI, is
     refused;
   - a normal expense in an active season still saves.
6. **If it goes wrong**:
   - Write a forward rollback migration from the `-- ROLLBACK:` block, and
     send it through the same PR → approve → migrate path.
   - If that path is itself broken: confirm a backup, then from your
     machine, on that commit, run `supabase db push --remote=<prod URL>
     --dry-run`, then the same without `--dry-run`.
   - I run nothing against production.

## Out of scope

- Recording payments after a season closes (D6).
- CI credential isolation (P1, dropped).
- `schema.sql` drift.
- The review's other findings: photo upload, delete error UIs, form UTC
  dates, pagination, `error.tsx`.
- `expenses.linked_activity_id`:
  - cross-owner references;
  - its SET NULL from an active-season activity onto a closed-season expense
    would be refused with `55000`. The app can't reach this, because it only
    links activities from the same season (`expense-actions.ts:87`).

## Performance

- The trigger adds one primary-key lookup with `FOR SHARE` per child write.
- At 10x load, the only contention is a write racing a close of the same
  season, which is rare and intended.
- Concurrent writers create multixacts on the season row, which is fine at
  this volume.
