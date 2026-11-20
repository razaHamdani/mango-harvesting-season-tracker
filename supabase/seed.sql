-- Local-only. Runs on `supabase start` / `supabase db reset`; `db push` never
-- sends it to production.
--
-- Marks this database as the local test target. tests/helpers/target-guard.ts
-- refuses to TRUNCATE any database without this comment, so a test run pointed
-- at production (wrong env file, shell variable, port tunnel) aborts.
-- (A custom setting via ALTER DATABASE ... SET is refused for `postgres` on
-- PG 17: 42501. The database comment needs only ownership, which it has.)
COMMENT ON DATABASE postgres IS 'aam-daata local test target';
