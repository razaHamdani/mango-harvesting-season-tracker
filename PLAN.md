# PLAN: Production blockers C1–C4

> Supersedes the previous PLAN.md (runtime test harness — completed 2026-05-18,
> see TASKS.md history). This plan covers the four blockers from the
> 2026-06-11 production-readiness review.

## Goal

Fix the four deployment blockers identified in the senior-engineer review:

- **C1** — Server Action errors never reach Sentry; `logError` is dead code
- **C2** — Closed seasons are mutable (deletes bypass the lifecycle guard)
- **C3** — Season date-window guard bypassed by unpadded dates (`2026-06-1`)
- **C4** — "Today" computed in UTC rejects legitimate PKT entries 00:00–05:00

No migrations, no schema changes — all four are app-layer. Rollback for every
phase is `git revert` of that phase's commit.

## Decisions (locked with user, 2026-06-11)

- **C3 uses `z.iso.date()`** (Zod v4 built-in), not `z.coerce.date()` and not
  a regex. Rationale: `z.coerce.date()` *accepts* the bypass input (parses via
  `new Date()`, which also mixes local-time vs UTC parsing per format) and
  widens the accepted surface; `z.iso.date()` enforces strict `YYYY-MM-DD`
  AND calendar validity (rejects `2026-02-30`), and keeps strings end-to-end.
- **C4 anchors "today" to a business timezone** via `APP_TIMEZONE` env var,
  **default `Asia/Karachi`** — dates record farm events, so the farm's
  timezone is the semantically correct anchor, regardless of where the viewer
  is. (Alternative "UTC + 1-day grace" rejected: user chose tz anchor.)
  Implementation: `new Intl.DateTimeFormat('en-CA', { timeZone }).format(new Date())`.

## Phases

### Phase B1 — Observability (C1)

1. `sentry.server.config.ts` + `sentry.edge.config.ts`: add
   `integrations: [Sentry.captureConsoleIntegration({ levels: ['error'] })]`.
   Verify the export exists in the installed `@sentry/nextjs@10.50.0` before
   relying on it. Fix the false comment claiming console capture already works
   (in both configs and in `logger.ts`'s docstring if needed).
2. Sweep server-side `console.error` call sites to `logError(scope, err)`
   so every action log carries the `req=<id>` prefix. In scope: all files
   under `src/lib/actions/` and the server-side utils
   (`farm-season-guard.ts`, `worker-guard.ts`, `photo.ts`), plus
   `auth/callback/route.ts` (route handler — `headers()` is available there).
   Out of scope: `rate-limiter.ts` (module-load context), `error.tsx`
   (client component).
3. Tests: unit test that a failing action path calls `logError`-style logging
   with the request id (extend `tests/request-context.test.ts` pattern), and
   a smoke test that `captureConsoleIntegration` is registered in the server
   config (import config, assert integration name present).

### Phase B2 — Date input hardening (C3)

1. `src/lib/utils/validators.ts`: replace `z.string().min(1, …)` with
   `z.iso.date(…)` on four fields: `installmentSchema.due_date`,
   `activitySchema.activity_date`, `expenseSchema.expense_date`,
   `paymentSchema.paid_date`. Keep per-field error messages.
2. Tests: `createExpense` with `expense_date: '2026-06-1'` on a season
   started `2026-06-05` must be rejected with a validation error (and must
   NOT insert). Same-shape quick cases for activity and payment dates;
   calendar-invalid case (`2026-02-30`) on one field.

### Phase B3 — Business-timezone "today" (C4)

1. New helper `todayInAppTz()` in `src/lib/utils/app-date.ts` (two consumers,
   so it gets its own file): reads `process.env.APP_TIMEZONE`, defaults to
   `'Asia/Karachi'`, returns `YYYY-MM-DD` via
   `Intl.DateTimeFormat('en-CA', { timeZone })`.
2. Use it in `assertWithinSeasonWindow` (replaces the UTC slice at
   season-date-guard.ts:43) and in `activateSeason`'s `started_at` stamp
   (season-actions.ts:197–202).
3. `.env.example`: document `APP_TIMEZONE` (optional, default Asia/Karachi).
4. Tests: with system time mocked to 21:00 UTC (= 02:00 PKT next day), a
   record dated "today in Karachi" (UTC tomorrow) is ACCEPTED; a record dated
   Karachi-tomorrow is rejected as future. `vi.setSystemTime` works here —
   the guard never persists the mocked date. Verify `activateSeason` stamps
   the Karachi date.

### Phase B4 — Closed-season immutability (C2)

1. `deleteExpense` (expense-actions.ts) and `deleteActivity`
   (activity-actions.ts): the existing Step-1 ownership query already selects
   from `seasons` — extend `select('id')` → `select('id, status')` and return
   `{ error: 'Records of a closed season cannot be deleted.' }` when
   `status === 'closed'`. Zero extra queries.
   (Draft seasons can't contain records — creates require active status — so
   only `closed` needs blocking.)
2. Tests: create expense + activity on an active season, close it, assert
   both deletes fail with the closed-season error and rows survive.

## Sequencing & gates

Order: B1 → B2 → B3 → B4 (matches review's patch plan; B2/B3 both touch the
date path so they're adjacent). Each phase ends with the /ship gate: full
test suite (requires `npx supabase start` — Docker), `tsc --noEmit`,
TASKS.md update, one commit per phase.

## Out of scope

Everything in the review's "Important improvements" list (deleteSeason race,
closeSeason warning, rate-limit double-count, expense-page query fan-out,
signed-URL batching, role clamp, workers audit trigger, etc.) — separate plan
after C1–C4 land.
