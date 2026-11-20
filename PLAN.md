# PLAN: Production credential isolation, test-DB guard, DB-enforced integrity

> Supersedes the previous PLAN.md (production blockers C1–C4, then R1–R4 and
> S1–S3 — all complete, see TASKS.md). Source: 2026-11-20 full code review,
> findings 1–3, revised with the owner's feedback the same day.
> Status: DRAFT — awaiting owner approval. Nothing below is implemented.

## Goal

1. **P1** — Production DB credentials can only be used by a job the owner has
   approved, on `main`. A PR or branch that edits `ci.yml` cannot reach them.
2. **P2** — The test suite cannot TRUNCATE any database except the local
   Supabase stack.
3. **P3** — Closed-season immutability, farm/worker ownership, and profile
   roles are enforced by Postgres, not only by the app.

## Discovery brief (verified 2026-11-20)

- `.github/workflows/ci.yml`: `pending-migrations` (l.98) and `migrate` (l.204)
  read **repo-level** secrets; only `approve-migrations` (l.157) has
  `environment: production-db`, and it holds no secrets. Repo secrets reach
  any same-repo `pull_request` run whose `ci.yml` asks for them.
- The three secrets (runbook l.105-108):
  - `SUPABASE_ACCESS_TOKEN` — personal access token: control of every project
    on the account. The most dangerous of the three.
  - `SUPABASE_DB_PASSWORD` — production `postgres` password.
  - `SUPABASE_PROJECT_ID` — the project ref. An identifier, not a credential;
    it moves with the others.
- The dry-run job holds the access token and the DB password, so dropping
  `--dry-run` in a commit on `main` would write to production unapproved.
- The production check already runs only on `push` to `main` (l.101).
- Supabase CLI: CI pins 3.1.0; `npx supabase` resolves 3.2.0. In 3.2.0,
  `db push --remote[=<ref|branch|url>]` accepts a URL, and `--password` is not
  used with a URL. So `migrate` can run without the access token.
- `gh` is not installed locally, so the GitHub environment settings were not
  read. They are verified at run time and in P1's gate.
- `tests/helpers/env.ts` checks only that the variables are present.
  `resetDb` (`tests/helpers/admin.ts:25`) TRUNCATEs on whatever
  `SUPABASE_DB_URL` points to. It is the only destructive SQL in `tests/`.
  `vitest.config.ts` loads `.env.test` without `override`, so the shell wins.
- Local `.env.test`: API is `127.0.0.1:54321` and DB is
  `127.0.0.1:54322/postgres`. Keys use the new `sb_` format, not JWTs, so no
  `iss` claim can be checked. `supabase/seed.sql` does not exist;
  `[db.seed]` is enabled with `./seed.sql` (`config.toml:60-65`).
- **Closed seasons in the app**:
  - Create and payment go through `assertWithinSeasonWindow`, which requires
    `status = 'active'` (`season-date-guard.ts:27`).
  - Deletes check for closed (`activity-actions.ts:127`,
    `expense-actions.ts:165`).
  - So the app treats a closed season as fully frozen. Closed seasons can
    still be deleted outright (`season-actions.ts:123`).
- `closeSeason` sets the status with a compare-and-set UPDATE
  (`season-actions.ts:299-304`), which takes a row lock on the season.
- Child RLS: one permissive FOR ALL policy per table. `season_farms` WITH CHECK
  checks only season ownership (`20260426000002:20-35`). `expenses.worker_id`
  has no ownership check.
- **Profiles**:
  - `handle_new_user` takes `role` from signup metadata
    (`20260420000000:26`).
  - `prevent_role_self_edit` blocks role changes on UPDATE only.
  - The profiles policy is FOR ALL (`initial_schema:127`), so a user can
    DELETE their profile and INSERT it again with `role = 'admin'`.
  - `ensureProfile` upserts the role from `user_metadata`, which the user
    controls (`profile-queries.ts:18`).
  - The app only ever offers `landlord` (`auth-actions.ts:9`).
- **The `admin` role grants nothing.** No RLS policy or function in
  `supabase/migrations/` reads `profiles.role`. It is an app-level label. It
  is not a Postgres role and has no `BYPASSRLS`.
- `expenses.worker_id` is `ON DELETE SET NULL`, which runs as an UPDATE on
  expenses. `workers` can already be deactivated (`toggleWorkerActive`).

## Decisions

- **D1 (P1)** The approval gate is the `production-db` environment's
  protection rules. The environment name alone enforces nothing. The rules:
  - a required reviewer (the owner);
  - "Allow administrators to bypass" off;
  - deployment branches limited to `main`;
  - the production secrets stored only in that environment.

  If the environment is deleted, GitHub recreates it empty: no reviewers and
  no secrets. The migrate job then has no credentials and fails closed.
  `migrate` also checks the rules through the API before it uses anything.
- **D2 (P1)** The pending-migrations check uses a read-only Postgres role,
  `migration_checker`. It has `SELECT` on
  `supabase_migrations.schema_migrations` and nothing else, and lives in a
  separate environment, `production-db-check` (branch `main` only, no
  reviewer). Removing a flag cannot turn it into a writer.
  - Rejected: deciding "pending" from the git diff of the push. It needs no
    credential, but after a rejected or late approval the next push with no
    new migration file would never ask again.
- **D3 (P1)** Merge `approve-migrations` into `migrate`. `migrate` itself runs
  in `production-db`, so approval and credential release are the same event.
  The 1-hour check moves in as `migrate`'s first step, before any secret is
  used.
- **D4 (P1)** Retire `SUPABASE_ACCESS_TOKEN` from CI.
  - `migrate` uses `db push --remote="$URL"` with one secret,
    `PROD_MIGRATE_DB_URL`.
  - The owner revokes the token in Supabase once P1 is verified.
- **D5 (P1)** PRs get no production checks. A same-repo PR runs on
  `refs/pull/N/merge`, which the branch policy refuses, so its jobs get no
  secrets. Production checks run only after merge, as they do today.
- **D6 (P3)** In the DB, a closed season is **fully frozen**: no INSERT, UPDATE
  or DELETE on activities, expenses, installments or season_farms, and no
  UPDATE of the closed `seasons` row. This mirrors what the app does today.
  - Recording a payment after close would be a new feature. It stays out of
    this plan.
  - Owner to confirm: the closed-season question was left unanswered; this
    is the default.
- **D7 (P3)** `paid_date` keeps its lower bound (`>= start_date`) and loses
  its upper bound (`<= end_date`), in both the DB trigger and the app guard.
  `due_date` keeps both bounds. (Owner chose this, 2026-11-20.)
- **D8 (P3)** Deleting a worker who has salary expenses in a closed season is
  blocked. `deleteWorker` checks first and says why; deactivating the worker
  stays available. (Product agent's advice, accepted.)

## Phases

Each phase is its own branch and PR, merged and verified before the next
starts. Order: P2 → P1 → P3.
- P2 first: it is local-only, and P3's tests depend on it.
- P1 before P3: P3's migration is the first real run of the new approval path.

### P2 — Test-DB guard

1. New `tests/helpers/target-guard.ts`:
   - `assertLocalTargetSync(env)` runs these checks:
     - each of `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_DB_URL` is present
       and parses with `new URL()`;
     - the protocol is `http:` (API) or `postgres:`/`postgresql:` (DB);
     - `hostname` exactly equals `127.0.0.1`, `localhost` or `[::1]`;
     - the API port is 54321, the DB port is 54322 and the path is
       `/postgres`;
     - the DB URL has no `host` or `hostaddr` query parameter, since `pg`
       honours those over the URL host.

     Errors name the variable and the rule that failed, never the value.
   - `assertLocalDatabase(pg)` runs on an open connection:
     `select current_setting('app.aam_test_target', true)` must equal
     `'local'`.
2. New `supabase/seed.sql`:
   `ALTER DATABASE postgres SET app.aam_test_target = 'local';`.
   - The seed runs only on local `start`/`db reset`. CI's `db push` never
     sends a seed.
   - Fallback: if `postgres` does not own the database,
     `ALTER ROLE postgres SET ...`.
3. Identity of the stack: `vitest.globalSetup` (new `tests/global-setup.ts`)
   runs once before any test file.
   - It runs `assertLocalTargetSync`.
   - It runs `supabase status -o json` and requires its API URL, DB URL and
     service/secret key to equal `.env.test`'s. A tunnel holding the local
     ports cannot match a running local stack.
     - [VERIFY NEEDED] the key names in 3.x output with `sb_` keys (the
       service key may be `SECRET_KEY`). Read them from the local
       `status -o json` before writing the check. CI's `.env.test` writer
       (`ci.yml:52-62`) uses the same names.
   - It opens a pg connection and runs `assertLocalDatabase`.
   - On mismatch it aborts the run without printing values.
4. Before every destructive path:
   - `env.ts` calls `assertLocalTargetSync` at import, which every helper
     does.
   - `resetDb` calls `assertLocalDatabase` on the same connection
     immediately before `TRUNCATE`.
   - `vitest.config.ts` loads `.env.test` with `override: true`, so a
     production URL in the shell cannot win. This is a supporting layer;
     the guard is the real control.
5. Tests: new `tests/target-guard.test.ts`, pure, no DB. Each must reject:
   - a missing var;
   - `not a url`;
   - `localhost.evil.com`;
   - `127.0.0.1.nip.io`;
   - `evil.com/localhost`;
   - `user:pw@localhost@evil.com`;
   - the wrong port;
   - `?host=evil.com`;
   - `https:` for the API.

   Accept the real local values. Assert that no error message contains the
   password or the full URL.
- **Gate**:
  - `npm test` is green locally and in CI.
  - With the local stack stopped, `npm test` aborts in `globalSetup`.
  - With `SUPABASE_DB_URL` exported as a non-local URL in the shell, the run
    still uses `.env.test` (override). With `.env.test` itself edited to a
    fake remote host, it aborts. Use a non-routable host, never a real one.
- **Rollback**: `git revert`. No DB or infrastructure change.

### P1 — Production credential isolation

The owner does steps 1–3 in the Supabase dashboard and GitHub settings. I
write the SQL and the checklist; I do not run anything against production.

1. **Read-only role**, in the Supabase SQL editor as `postgres`. The password
   is generated by the owner and never committed:
   `CREATE ROLE migration_checker LOGIN PASSWORD '…' NOINHERIT;`
   `GRANT USAGE ON SCHEMA supabase_migrations TO migration_checker;`
   `GRANT SELECT ON supabase_migrations.schema_migrations TO migration_checker;`
   - [VERIFY NEEDED] that the Supavisor pooler accepts a custom role, as
     `migration_checker.<ref>`. Gate: `psql "<pooler url>" -c "select
     count(*) from supabase_migrations.schema_migrations"` succeeds, and an
     `INSERT` into the same table fails with "permission denied".
2. **Environments**, in GitHub Settings → Environments:
   - `production-db`:
     - required reviewer: the owner;
     - "Prevent self-review" off, or the owner can never approve their own
       merge;
     - admin bypass off;
     - deployment branches: selected, `main` only;
     - secret `PROD_MIGRATE_DB_URL` (session pooler, `postgres` role).
   - `production-db-check`:
     - no reviewer;
     - deployment branches: `main` only;
     - secret `PROD_CHECK_DB_URL` (the `migration_checker` URL).
3. Delete the repo-level secrets `SUPABASE_ACCESS_TOKEN`,
   `SUPABASE_DB_PASSWORD` and `SUPABASE_PROJECT_ID`. This happens after the
   gate in step 6 passes; until then they stay, unused.
4. **`ci.yml`**:
   - `pending-migrations` gets `environment: production-db-check`.
     - It drops `supabase link` and the CLI dry-run.
     - It reads applied versions with `psql "$PROD_CHECK_DB_URL"`.
     - It compares them to the `supabase/migrations/*.sql` version prefixes.
     - Remote-only versions mean drift: fail with the list. Local-only
       versions are pending.
     - It keeps the `pending` and `asked_at` outputs and the step summary.
   - Delete `approve-migrations`.
   - `migrate` gets `environment: production-db` and
     `needs: pending-migrations`, guarded by `if: pending == 'true'`. Steps,
     in order:
     - (a) The gate check from today's approve job (`ci.yml:168-181`), plus a
       new rule: `deployment_branch_policy` must be non-null.
     - (b) The 1-hour check (`ci.yml:184-197`).
     - (c) `supabase migration list --remote="$PROD_MIGRATE_DB_URL"`.
     - (d) `supabase db push --remote="$PROD_MIGRATE_DB_URL" --yes`.
     - (e) `migration list` again.
     - Concurrency: `group: migrate-production`, `cancel-in-progress:
       false`, the same as today's `migrate` (`ci.yml:209-211`). It must
       never be `true`: a newer push would cancel a running `db push` and
       leave some files applied and the rest not. GitHub still replaces an
       older *pending* job in the group with the newer one.
       - [VERIFY NEEDED] that a job waiting for environment approval counts
         as pending. Gate (iv) below.
     - The secret is set only on the steps that run the CLI or psql, as
       today.
   - `newest-commit` gets `needs: [pending-migrations, migrate]`; this is
     unchanged.
   - Verified 2026-11-20: `db push` and `migration list` accept
     `--remote[=<ref|branch|url>]` in both 3.1.0 and 3.2.0, and
     `--password` is "not used for ... a database URL". There is no
     `--db-url`. The pin stays at 3.1.0.
   - [VERIFY NEEDED] that the URL form needs no `SUPABASE_ACCESS_TOKEN`.
     The help lists scoped-token permissions that "may be required with
     --remote". Gate (0) below.
   - Environment API permission: today's gate check already calls it with
     only `contents: read` (`ci.yml:166-173`). If (a) gets a 403, add
     `actions: read`.
5. `docs/runbook.md`: replace the secrets and environment section. Cover the
   new approval flow, rotating each URL, and creating and dropping the
   checker role.
6. **Gate**, in order:
   - (0) Before any YAML is written: locally, with `SUPABASE_ACCESS_TOKEN`
     unset, run `supabase migration list --remote="<local DB URL>"` and
     `supabase db push --remote="<local DB URL>" --dry-run`. Both succeed. If
     not, stop and revise D4.
   - (i) A throwaway PR, never merged, adds two jobs with no `if:`. One uses
     `environment: production-db-check`, the other `environment:
     production-db`, and each prints only the length of its environment's
     secret. Both must be refused by the branch policy, or print 0. A third
     job with no environment prints the length of `secrets.PROD_MIGRATE_DB_URL`
     and must print 0.
   - (ii) After merge, `pending-migrations` reports "up to date" using only
     the checker URL.
   - (iii) The checker credential cannot write. Locally, with the checker URL,
     an `INSERT` into `supabase_migrations.schema_migrations` fails with
     "permission denied".
   - (iv) P3's migration later exercises `migrate` end to end. Push a second
     commit to main while P3's approval waits: the older run's `migrate`
     must be cancelled while pending, and the newer one asks for approval.
   - Then do step 3, and revoke the access token in Supabase.
- **Rollback**:
  - `git revert` the `ci.yml` commit.
  - Re-create the repo-level secrets. The access token needs a new one if it
    was already revoked.
  - The checker role is harmless if left in place. To remove it:
    `DROP ROLE migration_checker;`. That is a DROP, so it needs the owner's
    explicit go.

### P3 — DB-enforced integrity

Three migrations in one PR, each with a `-- ROLLBACK:` block in the repo's
style (`20260504120000:44-55`). Rollback is a forward migration through the
same approval path.

Fallback, if P1's `migrate` job is broken when a rollback is needed:
- the owner confirms a backup;
- the owner runs `supabase db push --remote="<prod URL>" --dry-run`, then
  the same without `--dry-run`, from their machine, on a `main` checkout that
  contains the rollback migration.

Nothing is run against production by me.

Before merging:
- the owner confirms a fresh Supabase backup (or PITR);
- the owner runs the read-only audit queries in step 4 on production;
- the `pending-migrations` dry run lists exactly these three files.

**P3a — `20261120120000_closed_season_frozen.sql`**
1. `enforce_closed_season()`:
   - Settings: plpgsql, `SECURITY DEFINER`, `SET search_path = public`, owned
     by `postgres`, the table owner. Owner reads bypass RLS, because RLS is
     not `FORCE`d. So a season hidden from the caller by RLS is still found:
     "not found" only ever means "does not exist".
   - Season ids: INSERT uses NEW.season_id and DELETE uses OLD.season_id.
     UPDATE uses both OLD and NEW when they differ (a move between seasons),
     checking both the source and the destination.
   - Lock: `SELECT id, status FROM seasons WHERE id = ANY(ids) ORDER BY id
     FOR SHARE`.
     - `FOR SHARE` conflicts with the row lock `closeSeason`'s UPDATE takes.
       A child write and a close on the same season therefore serialize.
     - Under READ COMMITTED, a writer that waited re-reads the committed
       status and is rejected.
     - `ORDER BY id` gives a consistent lock order, which avoids deadlocks
       on season moves.
   - Any locked season `closed` → `RAISE EXCEPTION 'season is closed' USING
     ERRCODE = '55000'`.
   - Any id not found → allow. The foreign key guarantees the season exists
     unless it was deleted earlier in this transaction, which is the
     `ON DELETE CASCADE` of a season delete. No `pg_trigger_depth()`, and no
     "skip if another trigger is running".
2. BEFORE INSERT OR UPDATE OR DELETE triggers on `activities`, `expenses`,
   `installments` and `season_farms`.
3. `seasons`: a BEFORE UPDATE trigger rejects any UPDATE whose OLD.status is
   `closed`. DELETE stays allowed.
4. `enforce_season_date_range`: drop the `paid_date > v_end` check and keep
   `paid_date < v_start` (D7). `CREATE OR REPLACE` with the same signature.
5. App:
   - `assertWithinSeasonWindow` takes a flag that skips the end bound for
     `paid_date`; only `recordPayment` passes it.
   - `deleteWorker` checks first for salary expenses in closed seasons and
     returns "This worker has salary in a closed season and can't be
     deleted. Deactivate them instead."
   - Actions map SQLSTATE `55000` to "This season is closed." instead of the
     generic failure.
6. **Rollback**:
   - drop the five triggers and `enforce_closed_season()`;
   - `CREATE OR REPLACE` `enforce_season_date_range` with the upper bound
     back;
   - revert the app commit.

**P3b — `20261120120100_owner_bound_references.sql`**
1. Add RESTRICTIVE policies. They are ANDed with every permissive policy, so
   a future permissive policy cannot bypass them:
   - `season_farms`, FOR INSERT, `WITH CHECK (EXISTS (SELECT 1 FROM farms f
     WHERE f.id = farm_id AND f.owner_id = auth.uid()))`.
   - `season_farms`, FOR UPDATE: the same `WITH CHECK`, `USING (true)`.
     UPDATE is covered as well as INSERT.
   - `expenses`, FOR INSERT and FOR UPDATE: `worker_id IS NULL OR EXISTS
     (SELECT 1 FROM workers w WHERE w.id = worker_id AND w.owner_id =
     auth.uid())`.
2. `service_role` and `SECURITY DEFINER` functions still bypass RLS.
   `create_season_with_children` is `SECURITY INVOKER`
   (`20261114120000:199`), so the new policies apply to it as well. Its
   callers own their farms, so it is unaffected, and its own farm-ownership
   check stays.
3. **Rollback**: `DROP POLICY` on the four restrictive policies.

**P3c — `20261120120200_profile_role_lockdown.sql`**
1. `handle_new_user`: role is always `'landlord'`. Metadata is ignored for
   role.
2. Replace the FOR ALL profiles policy with:
   - `SELECT` USING `id = auth.uid()`;
   - `UPDATE` USING and WITH CHECK `id = auth.uid()`;
   - `INSERT` WITH CHECK `id = auth.uid() AND role = 'landlord'`, which keeps
     `ensureProfile` working;
   - no DELETE policy. Rows are removed only by the `auth.users` cascade.
3. Column privileges:
   - `REVOKE UPDATE ON profiles FROM anon, authenticated;`
   - `GRANT UPDATE (full_name, phone, updated_at) ON profiles TO
     authenticated;`
   - Keep `prevent_role_self_edit` as a second layer. [VERIFY NEEDED] in
     implementation: the column list against every app write to `profiles`.
4. App: `ensureProfile` stops sending `role`, and the column default applies.
5. **Rollback**:
   - re-create the FOR ALL policy;
   - `GRANT UPDATE ON profiles TO authenticated`;
   - restore the previous `handle_new_user` body;
   - revert the app commit.

**Step 4 — production audits**. All are read-only; the owner runs them and I
do not see row data:
- Non-landlord accounts:
  `select role, count(*) from profiles group by role;`. If any `admin` or
  `contractor` exists, the owner reviews each.
  - Demoting one is a separate, explicitly confirmed UPDATE.
  - The guard trigger blocks a session without a JWT. The UPDATE runs inside
    `BEGIN; ALTER TABLE profiles DISABLE TRIGGER profiles_guard_role; UPDATE
    …; ALTER TABLE … ENABLE TRIGGER …; COMMIT;`.
  - The migration itself changes no existing role.
- Cross-owner links:
  - `season_farms` rows whose farm owner differs from the season owner;
  - `expenses` rows whose worker owner differs from the season owner.

  Any hit stops P3 for the owner's decision. The new policies do not
  validate existing rows.
- Table ownership and RLS force. P3a's "not found means deleted" depends on
  the trigger function's owner bypassing RLS:
  - `select tablename, tableowner from pg_tables where schemaname =
    'public';`: every table must be owned by `postgres`.
  - `select relname from pg_class where relforcerowsecurity;`: no `public`
    table may be listed.

  Either failing stops P3.

**P3 tests** (new `tests/db-integrity.test.ts`, local DB):
- Closed season: as the owner's REST client, each of these fails with
  `55000` and leaves the row unchanged:
  - INSERT, UPDATE and DELETE on activities, expenses and installments;
  - INSERT and DELETE on season_farms;
  - UPDATE of the season row.
- Moving an expense from an active season to a closed one fails, and so does
  moving one from a closed season to an active one.
- Deleting a closed season with children succeeds and the children are gone
  (the cascade path).
- An active season accepts the same writes.
- Race, made deterministic with two pg connections:
  - Connection 2 runs `BEGIN; UPDATE seasons SET status='closed'`. An expense
    INSERT on connection 1 then blocks. After connection 2 commits,
    connection 1 fails with `55000`.
  - The reverse order: connection 1's open INSERT transaction makes the close
    on connection 2 wait until it commits.
- `paid_date` after `end_date` is accepted; `paid_date` before `start_date`
  is rejected.
- `deleteWorker` with a closed-season salary returns the message and the row
  survives.
- User B:
  - linking user A's farm to B's season (INSERT) fails;
  - re-pointing an existing B row to A's farm (UPDATE) fails;
  - using A's `worker_id` on B's expense fails, on INSERT and on UPDATE.
- Policy inventory: snapshot `pg_policies` for these five tables. A new
  policy fails the test until the snapshot is updated on purpose.
- `signUp` with `{ data: { role: 'admin' } }` gives a `landlord` profile.
- A user cannot DELETE their profile and cannot INSERT a profile with
  `role = 'admin'`. Their client's UPDATE of `role` fails with `42501`
  ("permission denied"): the column privilege fails before the trigger is
  reached.
- The trigger layer gets its own raw-`pg` test:
  - In one transaction, `SET LOCAL ROLE authenticated`, set
    `request.jwt.claims` to the user, and temporarily
    `GRANT UPDATE (role)` to `authenticated`.
  - The UPDATE of `role` fails with "role can only be changed by
    admin/service".
  - `ROLLBACK`.
- A profile with `role = 'admin'`, set by the service role, cannot read
  another user's farms. `admin` grants nothing.
- Existing tests that change on purpose:
  - `season-date-range.test.ts:268-271`, "rejects a payment dated after
    end_date", is inverted. A payment after `end_date` is now accepted (D7).
  - `profiles.test.ts:89-97` expects `/role can only be changed by admin/`.
    It now expects `42501`. The trigger message is covered by the raw-`pg`
    test above.
- These stay green unchanged:
  - `closed-season-immutability.test.ts`: it seeds the children while the
    season is active, then closes it.
  - `seasons.test.ts`;
  - `expenses.test.ts`;
  - `audit.test.ts`;
  - `auth.test.ts`.
- Fixture rule: the trigger also fires for `service_role`. Seed children
  first, then close the season.

**Gate**:
- locally: `supabase db reset`, then `npm test`, `tsc` and lint all green;
- `node scripts/check-migrations.mjs` passes;
- on merge: dry-run lists 3, owner approves, `migrate` succeeds, and the
  smoke check passes. The smoke check is to close a test season in prod and
  try to add an expense through the UI; it must be refused.

## Out of scope

- Recording payments after a season closes (D6).
- `schema.sql` drift.
- The review's other findings: photo-upload state, delete error UIs, form
  UTC dates, pagination, `error.tsx`.
- `expenses.linked_activity_id`:
  - cross-owner references;
  - its `ON DELETE SET NULL` from an active-season activity onto a
    closed-season expense. The trigger would refuse it with `55000`, but
    the app only links activities of the same season
    (`expense-actions.ts:87`), so it is unreachable through the app.
- Archiving instead of deleting farms.

## Performance

- The trigger adds one indexed PK lookup with `FOR SHARE` per child write.
- At 10x load, the only contention is a write against the same season's
  close, which is rare and intended.
- `FOR SHARE` from concurrent writers creates multixacts on the season row,
  which is acceptable at this write volume.
