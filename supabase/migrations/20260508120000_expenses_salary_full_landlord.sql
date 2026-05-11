-- Phase 12.1: Enforce landlord_cost = amount for salary expenses.
--
-- The createExpense action already ensures this at the app layer
-- (calculateLandlordCost returns totalCost for 'labor'), but a direct
-- Supabase API call or future edit path could violate the invariant.
-- This DB-level CHECK closes that gap.
--
-- Idempotent: DROP IF EXISTS + ADD (standard pattern used throughout
-- this codebase for CHECK constraints).

ALTER TABLE public.expenses
  DROP CONSTRAINT IF EXISTS expenses_salary_full_landlord;
ALTER TABLE public.expenses
  ADD CONSTRAINT expenses_salary_full_landlord
  CHECK (worker_id IS NULL OR landlord_cost = amount);
