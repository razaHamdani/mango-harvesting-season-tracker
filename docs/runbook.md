# AamDaata Runbook

## Sentry Alert Configuration

One-time setup in the Sentry dashboard after first production deploy.

### Alerts to create

1. **Unhandled exceptions** → email owner + Slack webhook (if in use)
   - Condition: any unhandled exception in `production` environment
   - Action: email + Slack

2. **High event rate** → page-priority alert
   - Condition: >10 events/minute
   - Action: email (page-priority)

3. **Regression** → email on previously resolved issue
   - Condition: issue regression (resolved → unresolved)
   - Action: email owner

### Release tracking

Releases appear in the Sentry dashboard automatically after each Railway deploy.
Sourcemaps are uploaded via `withSentryConfig` in `next.config.ts`.

### Retention

30 days (Sentry free-tier default). Review at day 90 if event volume grows.

### Required env vars (Railway)

| Variable | Notes |
|---|---|
| `SENTRY_DSN` | Server-side DSN |
| `NEXT_PUBLIC_SENTRY_DSN` | Client-side DSN (same value) |
| `SENTRY_AUTH_TOKEN` | For sourcemap upload during build |
| `SENTRY_ORG` | Your Sentry org slug |
| `SENTRY_PROJECT` | Your Sentry project slug |

### Smoke test procedure

To verify Sentry is wired up after a new production deploy:

1. Temporarily add `throw new Error('sentry-smoke')` inside a Server Action.
2. Deploy and trigger the action.
3. Confirm the error appears in Sentry within 30s with the `requestId` tag.
4. Remove the smoke test and redeploy.

---

## Database migrations (approved, 1-hour window)

Migrations in `supabase/migrations/` reach production only when you approve
them. After a merge to `main`, if production has pending migrations, CI asks
for approval; **no answer within 1 hour means no migration and no deploy.**

### Pipeline

1. **PR** — `Integration Tests` applies every migration to a fresh local
   database and runs the suite against it; `Lint & Type-check` runs the
   migration safety lint (`node scripts/check-migrations.mjs`).
2. **Merge to `main`** — lint, tests and build run again on `main`.
3. **`Check pending production migrations`** — a read-only
   `supabase db push --remote --dry-run` against production. Nothing
   pending: the migrate job is skipped, the run is green, Railway deploys.
   It compares against production, not the PR's files, so migrations you
   declined earlier are asked about again on the next merge.
4. **`Approve production migrations (within 1h)`** — runs in the GitHub
   environment `production-db` and waits for your approval. GitHub emails
   you; open the run and choose **Review deployments** → Approve or Reject.
   Once approved, it checks the environment still requires a reviewer with
   admin bypass off, and that the approval came within 1 hour of the
   request. It holds no secrets and touches no database.
   - **Approved within 1 hour** — `Migrate production DB` runs next.
   - **Rejected or approved after 1 hour** — nothing is applied and the run
     goes red. GitHub cannot shorten its 30-day approval window, so the job
     itself refuses a late approval.
   - **Never answered** — nothing is applied and the run stays yellow
     ("Waiting") until you reject it or a newer merge replaces it. It does
     not hold up later merges: each run on `main` runs on its own, and a
     newer merge's approval request cancels an older one still waiting.
5. **`Migrate production DB`** — runs `supabase db push --remote` (listing
   migrations before and after). A running push is never cancelled, and only
   one runs at a time: an approved run waits for the one in progress, and a
   newer approved run replaces one still queued (the newer push applies the
   same migrations). If you merge again while a push is running, you may be
   asked again for the same migrations; approving then applies nothing new.
6. **`Newest commit on main`** — fails the run if `main` has moved on to a
   newer commit. Runs on `main` overlap, so this stops Railway deploying an
   older commit over a newer one. The newer commit's run deploys instead.
7. **Railway deploy** — with *Wait for CI* on, Railway deploys only if the
   whole run is green. A "no" (or no answer) therefore means **that commit
   is not deployed**: its code may expect the new schema. Production stays
   on the previous version until a later run is approved.
8. **Railway healthcheck** — the new deployment must answer `/api/health`
   with 200 (it queries the database) or Railway keeps the old deployment
   live.

To be asked again for the same commit, open the run and use **Re-run all
jobs**. Re-running only failed jobs keeps the original request time, so
it would refuse again as late.

### One-time setup

- **GitHub repo secrets** (Settings → Secrets and variables → Actions):
  - `SUPABASE_ACCESS_TOKEN` — a Supabase personal access token
  - `SUPABASE_DB_PASSWORD` — the production database password
  - `SUPABASE_PROJECT_ID` — the production project ref
  These stay repo-level: the pending check reads production before anyone
  approves.
- **GitHub environment `production-db`** (Settings → Environments):
  - Required reviewers: the owner only; **Prevent self-review off** (you
    approve your own merges).
  - **Allow administrators to bypass** off.
  - Deployment branches: `main` only.
  The approve job fails, and nothing is migrated, if this environment is missing,
  has no required reviewer, or allows admin bypass. Don't reuse
  `loyal-imagination / production`: Railway creates and names that one.
- **Railway** → service → Settings: turn **Wait for CI** on.
- **Branch protection** — see below.

### Writing migrations

- **Expand/contract.** Add new columns/tables/functions now; drop or rename
  the old ones in a *later* PR, once the deployed app no longer uses them.
  The app deploys after the migration, so for a few minutes the old app runs
  against the new schema.
- **Destructive changes** (DROP TABLE/COLUMN/FUNCTION/VIEW/TYPE/SCHEMA/SEQUENCE,
  TRUNCATE, RENAME, column type changes) fail the lint unless the file has a
  line comment saying why:
  `-- safety: allow-destructive <reason>`
  The line covers every destructive statement in that file, so keep
  destructive changes in their own small migration.
- **No `BEGIN;` / `COMMIT;`** (or START TRANSACTION, END, ROLLBACK). The CLI
  already runs each file in its own transaction; an explicit COMMIT ends it
  early and breaks automatic rollback. The lint rejects these, no override.
- Create files with `supabase migration new <name>` (name pattern
  `<14 digits>_<lowercase_name>.sql`). Files up to `20261114120000` predate
  the lint and are grandfathered.
- **Never change the production schema in the Supabase SQL editor.** Every
  change goes through a migration file. Pasting SQL in the dashboard is how
  production lost its migration history before.

### What is and isn't rolled back

- A migration file that fails rolls back fully, including its history row.
- Earlier files in the same push stay applied; the next run continues from
  the file that failed.
- A migration that succeeds but is wrong is not undone automatically — fix it
  with a new forward migration.
- Data changes (deleted rows, dropped columns) only come back from a backup.
  Before merging a risky migration, run `supabase db dump --remote -f
  backup.sql` locally. Never commit or upload that file — the repo is public.

### When the migrate job goes red

1. Open the failed run and see which step failed. **Check the approval gate
   is configured** or **Check approval came within 1 hour** (in the approve
   job) means nothing was applied: fix the environment settings or re-run all jobs. Otherwise
   read the **Apply migrations** step log for the SQL error.
2. The live app is unaffected: Railway did not deploy this commit.
3. Fix it with a new PR. Never edit a migration that is already applied.
4. If the migration history is out of sync with the database, inspect it
   with `supabase migration list --remote` and fix the history with
   `supabase migration repair`.

---

## Branch Protection (GitHub)

Configure in **Settings → Branches → Branch protection rules** for `main`:

- Require status checks to pass: `Lint & Type-check`, `Integration Tests`,
  `Build` (the jobs' display names)
- Do **not** make `Check pending production migrations`,
  `Approve production migrations (within 1h)`, `Migrate production DB` or
  `Newest commit on main` required checks — they never run on PRs, so a PR would wait for them
  forever
- Require branches to be up to date before merging
- Required approvals: 0 (solo maintainer; GitHub forbids approving your own
  PR)

---

## Email Confirmation (Resend + Supabase)

### Production SMTP settings (Supabase dashboard → Auth → SMTP)

| Field | Value |
|---|---|
| Host | `smtp.resend.com` |
| Port | `465` |
| User | `resend` |
| Password | `<resend api key>` |
| Sender email | `noreply@<your-domain>` |
| Sender name | `AamDaata` |

### Email template

Customize in Supabase → Auth → Email Templates. Keep it short. Include a confirm link and brief Urdu greeting if relevant to your audience.

### Existing users (one-time)

If any pre-existing users were created before `enable_confirmations = true` was set, run:

```sql
UPDATE auth.users
SET email_confirmed_at = NOW()
WHERE email_confirmed_at IS NULL;
```

Run this via the Supabase SQL editor before enabling confirmations in production to avoid locking out existing users.
