# TASKS

## Currently Working On

(none — all tasks complete)

## Completed

- [x] T1: `supabase init` + move schema into numbered migration
- [x] T2: `npx supabase start` (Docker) — captured URL/anon/service keys into `.env.test`; added to `.gitignore`
- [x] T3: Installed dev deps (`vitest`, `@vitest/ui`, `dotenv`); added `test` and `test:watch` scripts to `package.json`
- [x] T4: `vitest.config.ts` — node env, `@/*` alias, `.env.test` loader, `setupFiles: tests/setup.ts`
- [x] T5: `tests/setup.ts` — `vi.mock('@/lib/supabase/server')` injects authed client; `vi.mock('next/cache')` no-ops `revalidatePath`
- [x] T6: `tests/helpers/` — env loader, admin client, `createTestUser`, `resetDb`, `deleteTestUser`
- [x] T7: `tests/payments.test.ts` — RC-2 concurrent + sequential double-record
- [x] T8: `tests/seasons.test.ts` — RC-1 bad installment sums, FK violation → full rollback, valid creation
- [x] T9: `tests/photos.test.ts` — PHOTO-1 valid path persisted, spoofed/wrong-season path → null
- [x] T10: `tests/README.md` — prereqs, run instructions, test inventory
- [x] T11: Full suite green (9/9 tests pass)
- [x] T12: Committed and pushed to origin/main

## Remaining

(none)

## Decisions & Deviations

- 2026-04-17: seasons test covers 3 scenarios: bad sum (app-level early exit), valid creation (all 3 tables populated), FK violation (RPC rollback). No mocking of DB errors needed — passing bogus farm UUID triggers real FK constraint.
- 2026-04-17: photos test uses `createActivity` (not expense/payment) since activity-actions has the cleanest photo_path validation to test; the validation pattern is identical across all three action files.
