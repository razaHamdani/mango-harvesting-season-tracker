# TASKS

## Currently Working On

(none — Phases 1–4 complete)

## Completed

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

## Remaining

- [ ] Phase 3.2: PostgREST aggregate for `getExpenseTotals` — requires Docker/Supabase running to verify aggregate syntax support
- [ ] Phase 3.7: `unstable_cache` wrappers — deferred (single-user ERP, low ROI without real traffic data)
- [ ] Phase 4.2: Email confirmation (`enable_confirmations = true`) — deferred pending SMTP provider decision
- [ ] Integration test suite (payments, seasons, photos, profiles, expenses, activities) — requires Docker running

## Decisions & Deviations

- 2026-04-17: seasons test covers 3 scenarios: bad sum (app-level early exit), valid creation (all 3 tables populated), FK violation (RPC rollback). No mocking of DB errors needed — passing bogus farm UUID triggers real FK constraint.
- 2026-04-17: photos test uses `createActivity` (not expense/payment) since activity-actions has the cleanest photo_path validation to test; the validation pattern is identical across all three action files.
- 2026-04-26: Phase 3.7 (unstable_cache) skipped. Single-user ERP — concurrent loads of same data are rare. React cache() from 3.1 handles per-request dedup. Adding revalidateTag to all action files is high surface area for low gain.
- 2026-04-26: Phase 4.2 (email confirmation) deferred — SMTP provider not yet decided. Options: Supabase-hosted or Resend/SendGrid.
- 2026-04-26: Phase 3.2 (PostgREST aggregates) deferred — Docker not running during implementation session. Need to verify aggregate function syntax support on local Supabase before merging.
