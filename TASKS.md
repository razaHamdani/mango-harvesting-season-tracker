# TASKS

## Currently Working On

Nothing — Phase 10 complete.

## Completed

- [x] Phase 9A: Duplicate-email signup error — `signUpUser` now detects empty `identities` array (silent Supabase behavior) and "For security purposes" rate-limit error, returning `'Email already in use.'`; test added to `auth-confirmation.test.ts`
- [x] Phase 9B: Email confirmation redirect — proxy forwards `token_hash` query param to `/auth/callback` instead of stripping it on redirect to `/login` (`proxy.ts`)
- [x] Phase 9C: Linked expenses on activity rows — `ActivityWithFarm` extended with `linked_expenses[]`; `getActivities` batch-fetches linked expenses after page query; `ActivityList` adds Expenses column with deep-link navigation to `/seasons/{id}/expenses#expense-{id}`; expense `TableRow`s get `id` attributes; 2 new tests in `activities.test.ts`
- [x] Phase 10A: `started_at DATE` on seasons — new migration `20260502120000_seasons_started_at.sql` adds the column + CHECK `(status = 'draft' OR started_at IS NOT NULL)`. `activateSeason` sets `started_at = today` (UTC ISO date) alongside `status = 'active'`. `seasons` Row/Insert/Update in `database.ts` extended. New `seasons.test.ts` block asserts null on draft → today on activate → preserved through close.
- [x] Phase 10B: Season window guard — new helper `src/lib/utils/season-date-guard.ts` (`assertWithinSeasonWindow`) wired into `createActivity` (field-keyed `activity_date` error), `createExpense` (field-keyed `expense_date` error), and `recordPayment` (string error). Rejects child records dated before `started_at` AND blocks any write to a non-active season. New "season window guard (Phase 10)" describes in `activities.test.ts`, `expenses.test.ts`, `payments.test.ts` cover before-start rejection, draft-season rejection, and on/after acceptance. All existing test fixtures patched with `started_at: '2026-01-01'` to satisfy the CHECK. 108 tests passing, tsc clean.
- [x] Phase 9.5A: Duplicate email pre-check — `email_exists` SECURITY DEFINER RPC queries `auth.users`; `signUpUser` calls it before `signUp`, fails-closed on RPC error ("Something went wrong, please try again"), returns "Email already registered." on hit; fallbacks A/B removed; email format validated via regex before RPC; migration `20260430120000_email_exists_rpc.sql`; test updated + new format-validation test; 86 tests passing
- [x] Phase 9.5B: Photo thumbnails in list rows — `PhotoThumbnailClient` (client component) fetches 300s signed URL in a `useEffect` and renders via `PhotoThumbnailLightbox`; wired into `activity-list.tsx` and `expense-list.tsx` (replaces static CameraIcon)
- [x] Phase 9.5C: Custom email confirmation template — `supabase/templates/confirmation.html` hard-codes `/auth/callback?token_hash={{ .TokenHash }}&type=email&next=/dashboard`; wired in `config.toml`; bypasses Supabase's PKCE `/verify` endpoint entirely; Supabase restarted to apply
- [x] Phase 9D: Linked activity on expense rows — `ExpenseWithFarm` extended with `linked_activity`; `getExpenses` uses embedded join `activities!linked_activity_id`; `ExpenseList` adds Activity column with deep-link to `/seasons/{id}/activities#activity-{id}`; activity `TableRow`s get `id` attributes; 2 new tests in `expenses.test.ts`; colSpan footer updated; 85 tests passing
- [x] Phase 8A: Predetermined amount validation — removed `min="0.01"` HTML attr from input; added JS check in `handleSubmit` setting `errors.predetermined_amount` with "Value must be greater than 0" (`season-create-form.tsx`)
- [x] Phase 8B: CSP photo upload fix — `buildCsp()` now injects `NEXT_PUBLIC_SUPABASE_URL` into `connect-src` and `img-src` so browser-direct uploads work against local Supabase (`proxy.ts`)
- [x] Phase 8C: Expense/Activity filter remount — added `key={JSON.stringify(filters)}` to `<ExpenseList>` and `<ActivityList>` so React replaces stale `useState` on filter change (`expenses/page.tsx`, `activities/page.tsx`)
- [x] Auth callback route (`src/app/auth/callback/route.ts`) — exchanges email confirmation `token_hash` for session via `verifyOtp`; `/auth/callback` whitelisted in `proxy.ts`
- [x] Login page: password requirements hint (min 10, upper+lower+digit), `minLength` fixed 6→10, Inbucket dev hint on confirmation screen
- [x] Login page: removed `useSearchParams` (caused blank page without Suspense boundary), replaced with `useEffect` + `window.location.search`
- [x] Phase 1: Critical security fixes (RPC auth guard, IDOR deletes, photo path validation, storage RLS, generic errors, role allowlist)
- [x] Phase 2: Upstash Redis rate limiting (authLimiter, mutationLimiter, uploadLimiter, enforceLimit, client IP extraction, proxy wiring)
- [x] Phase 3.1: `_user-context.ts` with React `cache()`-wrapped `getCurrentUser()` — refactored all query files + 3 pages
- [x] Phase 3.3: SQL CTE migration for `get_season_insights` (4 table scans instead of 7) — ownership guard preserved verbatim
- [x] Phase 3.4: `getSeasonComparison` — batch ownership check (1 `.in()` query) + parallel RPC calls
- [x] Phase 3.5: `getSeasonFarms` — embedded join replaces two-query N+1
- [x] Phase 3.6: `getDashboardData` — `maybeSingle()` active season query + parallel count queries (eliminated JS `.find()`)
- [x] Phase 3.8: RLS EXISTS rewrite migration (season_farms, installments, activities, expenses)
- [x] Phase 4.1: Security headers in `next.config.ts` (CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy)
- [x] Phase 4.3: Password policy (min 10, lower_upper_letters_digits)
- [x] Phase 4.4: Session timeouts (7d timebox, 24h inactivity)
- [x] T1–T12: Initial test harness and bug fixes
- [x] Phase 5A.1: `signInUser` rate limiting — mirrors `signUpUser` pattern, IP-keyed, fail-closed
- [x] Phase 5A.2: `uploadLimiter` dead code removed; bucket-level MIME + size enforcement is the real protection
- [x] Phase 5A.3: `next.config.ts` `allowedOrigins` — unconditionally includes `localhost:3000` (was conditional on env var)
- [x] Phase 5B.1: Storage cleanup on delete — `deleteExpense`, `deleteActivity`, `deleteSeason` all best-effort remove orphan objects
- [x] Phase 5B.2: `createExpense` `linked_activity_id` ownership check — rejects activity from another user's season
- [x] Phase 5B.3: `getInstallments` ownership pre-check — consistent with `getExpenses`/`getActivities` pattern
- [x] Phase 5B.4: Partial index `idx_installments_season_due_date` (unpaid rows, season+due_date)
- [x] Phase 5C.1: Sentry wiring (`@sentry/nextjs`, `withSentryConfig`, all three config files, `.env.example`)
- [x] Phase 5C.2: Request-ID propagation — proxy sets `x-request-id`, `logger.ts` reads it for tagged server-action logs
- [x] Phase 5D.1: `auth.test.ts` — `signInUser` rate-limit mock test (blocks on exhausted limit)
- [x] Phase 5D.3: `expenses.test.ts` — foreign `linked_activity_id` rejected with "Linked activity not found."
- [x] Phase 5D.4: `seasons.test.ts` — foreign farm_ids rejected (surfaced + fixed RPC hole with new migration)
- [x] Phase 5D.5: `seasons.test.ts` — `activateSeason` concurrency: only one activation wins
- [x] Phase 5D.6: `photos.test.ts` — storage RLS two-segment test (upload to own uid + foreign season_id rejected)
- [x] Phase 5D.7: `seasons.test.ts` — `closeSeason` warns on unpaid installments (code + test)
- [x] Migration `20260427093750_verify_farm_ownership_in_rpc.sql`: farm ownership check in `create_season_with_children` RPC
- [x] Phase 6A: CI pipeline — `.github/workflows/ci.yml` (lint-typecheck, test, build jobs; Supabase in CI via setup-cli)
- [x] Phase 6B: Sentry alert routing — `Sentry.setTag('requestId')` in proxy.ts; `docs/runbook.md` with alert config, branch protection, SMTP docs
- [x] Phase 6E: Client-side image compression — `browser-image-compression` installed; `src/lib/utils/compress-image.ts` util; wired into `photo-upload.tsx` with compressing/uploading UI states; `tests/compress-image.test.ts`
- [x] Phase 6C: Email confirmation — `enable_confirmations = true` in supabase/config.toml; `signUpUser` returns `{ pendingConfirmation: true }`; `resendConfirmation` action added; login page shows pending-confirmation screen with resend button; `tests/auth-confirmation.test.ts`
- [x] Phase 6D: Audit log — migration `20260428000000_audit_log.sql` (audit_events table + fn_audit_event trigger on 6 tables + RLS); `tests/audit.test.ts` (INSERT/UPDATE/DELETE capture + RLS cross-user isolation)
- [x] Phase 7A: Audit migration fixes — removed `audit_payments` (table doesn't exist); added sentinel UUID `00000000-...` for cascade-delete actor via `COALESCE(auth.uid(), ...)` + service-role read policy
- [x] Phase 7B: Image upload correctness — extension derived from `uploadFile.type` MIME (not original filename); `contentType` passed to storage upload; `preserveExif: true` added to compression options
- [x] Phase 7C: `resendConfirmation` hardened — rate-limited via `authLimiter`; always returns `{ ok: true }` (defeats email enumeration); login page shows constant message
- [x] Phase 7D: Sentry requestId moved from global `Sentry.setTag` (hub race) to `beforeSend` hook in server + edge configs reading `x-request-id` header; CI pinned to `supabase/setup-cli@v1 version: 1.226.4`; job timeouts added; `SUPABASE_DB_URL` added to `.env.test`; heredoc indentation fixed
- [x] Phase 7E: Tests — cascade-delete sentinel actor, per-table trigger smoke (seasons, expenses), RLS direct-insert denial, `resendConfirmation` constant response for known+unknown email, `compressForUpload` options updated with `preserveExif`, PNG→JPEG type assertion; `.neq('id', 0)` → `.gt('id', 0)` cleanup
- [x] Phase 7 review fix B1: `attachRequestContext()` helper (`src/lib/utils/request-context.ts`) wired into `createClient` — Sentry `getCurrentScope().setTag('requestId', ...)` now reliably attaches to Server Action events (replaces flaky `beforeSend` reading middleware-set headers). 3 unit tests (`tests/request-context.test.ts`) cover happy path, missing header, and `headers()` throwing.
- [x] Phase 7 review polish I1: `extensionForMime()` extracted to `compress-image.ts`; fallback is now `'jpg'` (universal default) instead of input filename ext (which would resurrect the bug 7B fixed). 2 unit tests added (`tests/compress-image.test.ts`).
- [x] Phase 7 review polish I2: SQL comment on the redundant service-role policy in audit migration explains it's documentation-only (service_role bypasses RLS unconditionally).
- [x] Phase 7 review tests: per-table trigger smoke for `installments` + `activities`; audit RLS denies UPDATE and DELETE from authenticated user; `resendConfirmation` rate-limit path test (`tests/resend-confirmation-rate-limit.test.ts`) — total: 80 tests passing.

## Remaining

- [ ] Phase 3.2: PostgREST aggregate for `getExpenseTotals` — requires Docker/Supabase running to verify aggregate syntax support
- [ ] Phase 3.7: `unstable_cache` wrappers — deferred (single-user ERP, low ROI without real traffic data)
- [ ] Phase 4.2: Email confirmation (`enable_confirmations = true`) — deferred pending SMTP provider decision
- [ ] Phase 5D.2: Photo MIME/size rejection (bucket-level) — requires E2E test with real storage upload; deferred

- 2026-04-28: Phase 6D.4 (audit log UI) deferred per plan — wait for real data before designing the activity history page.

## Decisions & Deviations

- 2026-04-17: seasons test covers 3 scenarios: bad sum (app-level early exit), valid creation (all 3 tables populated), FK violation (RPC rollback). No mocking of DB errors needed — passing bogus farm UUID triggers real FK constraint.
- 2026-04-17: photos test uses `createActivity` (not expense/payment) since activity-actions has the cleanest photo_path validation to test; the validation pattern is identical across all three action files.
- 2026-04-26: Phase 3.7 (unstable_cache) skipped. Single-user ERP — concurrent loads of same data are rare. React cache() from 3.1 handles per-request dedup. Adding revalidateTag to all action files is high surface area for low gain.
- 2026-04-26: Phase 4.2 (email confirmation) deferred — SMTP provider not yet decided. Options: Supabase-hosted or Resend/SendGrid.
- 2026-04-26: Phase 3.2 (PostgREST aggregates) deferred — Docker not running during implementation session. Need to verify aggregate function syntax support on local Supabase before merging.
- 2026-04-27: Phase 5D.4 test surfaced a real security hole — `create_season_with_children` allowed linking foreign farm IDs. Fixed via migration `20260427093750` adding ownership pre-check before the `season_farms` insert.
- 2026-04-27: Phase 5D.2 (bucket MIME/size rejection via direct upload) deferred — requires E2E harness or raw storage API call in a test environment with bucket policies fully applied. Lower priority than code-path tests.
- 2026-04-28: 6C confirmation tests split into a new file `auth-confirmation.test.ts` (integration, real Supabase) rather than appended to `auth.test.ts` (unit/mock only) to preserve the mock-vs-integration separation.
- 2026-04-28: 6D audit cleanup uses `.delete().neq('id', 0)` between tests (admin client bypasses RLS) since resetDb only truncates application tables, not audit_events.
- 2026-04-28: Phase 7 — audit trigger on `payments` removed (table non-existent); will be added in the migration that creates the payments table.
- 2026-04-28: Phase 7 — Sentry `requestId` moved to `beforeSend` (server+edge configs) reading `x-request-id` header, avoiding global hub mutation that bleeds across concurrent requests.
- 2026-04-28: Phase 7 — CI `.env.test` heredoc had leading whitespace from shell indentation; fixed by aligning EOF content at column 0 inside the `run:` block.
- 2026-04-28: B1 implementation — chose to hook `attachRequestContext()` inside `createClient` rather than touch all 22 Server Actions individually. Single-touchpoint approach: every action calls `createClient` near the top, and tests mock the entire `@/lib/supabase/server` module so test isolation is preserved. Rejected the wrapper-per-action approach as too invasive for the win.
- 2026-05-02: Phase 10 — `started_at` is DATE (not TIMESTAMPTZ): comparison columns (`activity_date`, `expense_date`, `paid_date`) are all DATE; mixing types means casting on every comparison. `closed_at` stays TIMESTAMPTZ for audit precision; `started_at` is a business boundary so DATE fits.
- 2026-05-02: Phase 10 — enforcement is app-level only (no DB trigger). Every write to activities/expenses/installments goes through a server action; the helper centralises the check. CHECK constraint on `seasons` is the only DB-level guarantee.
- 2026-05-02: Phase 10 — no backfill in the migration. The user wiped existing season data before applying. If legacy active/closed rows had remained, the CHECK would reject them at apply time.
- 2026-05-02: Phase 10 — installment `due_date` is intentionally NOT validated against `started_at`. Installments are created at season creation (pre-activation), so a `due_date` may legitimately predate the start. Only `paid_date` is enforced (when recording a payment).
- 2026-05-02: Phase 10 — draft-season writes blocked entirely. `assertWithinSeasonWindow` returns "Season is not active" for any non-active status. Rationale: no `started_at` means no window to validate against; activities/expenses/payments only make sense once the season is live.
- 2026-05-02: Phase 10 — originally proposed dashboard "End Season" button was dropped. The existing `SeasonActionButtons` on `/seasons/{id}` stays as the single entry point for closing.
- 2026-05-01: Phase 9.5A — `email_exists` RPC is an intentional enumeration vector; user explicitly accepted this trade-off (friendlier UX over enumeration resistance).
- 2026-05-01: Phase 9.5A — removed fallback A ("For security purposes" string match) and fallback B (`identities.length === 0`); RPC pre-check is now the single authoritative duplicate-email gate. If the RPC itself errors, fail-closed and do not proceed to `signUp`.
- 2026-04-28: B1 keeps `beforeSend` hook in sentry.{server,edge}.config.ts as defense-in-depth — if `next/headers` ever exposes the value via `event.request.headers`, the tag still attaches; otherwise the per-async-context scope path is authoritative.
