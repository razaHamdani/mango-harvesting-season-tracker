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

Releases appear in the Sentry dashboard automatically after each Vercel deploy.
Sourcemaps are uploaded via `withSentryConfig` in `next.config.ts`.

### Retention

30 days (Sentry free-tier default). Review at day 90 if event volume grows.

### Required env vars (Vercel)

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

## Branch Protection (GitHub)

Configure in **Settings → Branches → Branch protection rules** for `main`:

- Require status checks to pass: `lint-typecheck`, `test`, `build`
- Require branches to be up to date before merging
- (Optional) Require 1 approving review on PRs

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
