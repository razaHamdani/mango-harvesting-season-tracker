-- Phase 12: Add worker_id FK to expenses table.
-- Salary payments are filed as 'labor' category expenses linked to a specific worker.
-- worker_id is nullable (existing rows + casual labor = no worker).
-- CHECK constraint enforces worker_id is only valid for the 'labor' category.
-- ON DELETE SET NULL: deleting a worker orphans the expense row but doesn't destroy history.

ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS worker_id UUID;

ALTER TABLE public.expenses
  DROP CONSTRAINT IF EXISTS expenses_worker_id_fk;
ALTER TABLE public.expenses
  ADD CONSTRAINT expenses_worker_id_fk
  FOREIGN KEY (worker_id) REFERENCES public.workers(id) ON DELETE SET NULL;

-- ADD CONSTRAINT IF NOT EXISTS is not valid Postgres syntax for CHECK constraints.
-- Use DROP/ADD pattern for idempotency.
ALTER TABLE public.expenses
  DROP CONSTRAINT IF EXISTS expenses_worker_only_for_labor;
ALTER TABLE public.expenses
  ADD CONSTRAINT expenses_worker_only_for_labor
  CHECK (worker_id IS NULL OR category = 'labor');

CREATE INDEX IF NOT EXISTS idx_expenses_worker_id
  ON public.expenses(worker_id) WHERE worker_id IS NOT NULL;
