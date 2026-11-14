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

## Database migrations (automatic)

Migrations in `supabase/migrations/` are applied to production automatically
when a PR merges to `main`. There is no manual approval step; the guardrails
below are what keep it safe.

### Pipeline

1. **PR** — `Integration Tests` applies every migration to a fresh local
   database and runs the suite against it; `Lint & Type-check` runs the
   migration safety lint (`node scripts/check-migrations.mjs`).
2. **Merge to `main`** — lint, tests and build run again on `main`.
3. **`Migrate production DB`** — once all three pass, this job links the
   project and runs `supabase db push --remote` (listing migrations before
   and after). Runs on `main` are never cancelled, and only one migrate job
   runs at a time, so a quick second merge waits instead of interrupting.
4. **Railway deploy** — with *Wait for CI* on, Railway deploys only if the
   whole run (including `Migrate production DB`) is green.
5. **Railway healthcheck** — the new deployment must answer `/api/health`
   with 200 (it queries the database) or Railway keeps the old deployment
   live.

### One-time setup

- **GitHub repo secrets** (Settings → Secrets and variables → Actions):
  - `SUPABASE_ACCESS_TOKEN` — a Supabase personal access token
  - `SUPABASE_DB_PASSWORD` — the production database password
  - `SUPABASE_PROJECT_ID` — the production project ref
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

1. Open the failed run and read the **Apply migrations** step log for the
   SQL error.
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
- Do **not** make `Migrate production DB` a required check — it never runs on
  PRs, so a PR would wait for it forever
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
