# Test Suite

Runtime integration tests for the three fixed race conditions.

## Prerequisites

1. **Docker Desktop** must be running.
2. **Supabase local stack** must be started:
   ```
   npx supabase start
   ```
   This prints the local API URL, anon key, and service role key.
3. **`.env.test`** must exist in the project root with these variables:
   ```
   NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key from supabase start>
   SUPABASE_SERVICE_ROLE_KEY=<service role key from supabase start>
   SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres
   ```
   This file is gitignored.

## Running

```bash
npm run test          # run once
npm run test:watch    # watch mode
```

## Test files

| File | What it covers |
|------|---------------|
| `tests/payments.test.ts` | RC-2: concurrent + sequential double-payment prevention |
| `tests/seasons.test.ts` | RC-1: bad installment sums rejected; FK violation rolls back atomically |
| `tests/photos.test.ts` | PHOTO-1: valid path persisted; spoofed/wrong-namespace path → null |

## How it works

Each test file:
- Creates a throwaway auth user via Supabase admin API
- Seeds the minimum rows needed via that user's authenticated client (RLS applies)
- Injects the authenticated client into server actions via `vi.mock('@/lib/supabase/server')`
- Calls the actual server action functions directly (no HTTP)
- Asserts DB state via the admin (service-role) client

`beforeEach` resets all app tables via `TRUNCATE … CASCADE` and creates a fresh user, so tests are fully isolated.
