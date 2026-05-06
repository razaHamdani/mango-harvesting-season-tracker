-- Phase 12: Add worker_id FK to expenses table.
-- Salary payments are filed as 'labor' category expenses linked to a specific worker.
-- worker_id is nullable (existing rows + casual labor = no worker).
-- CHECK constraint enforces worker_id is only valid for the 'labor' category.
-- ON DELETE SET NULL: deleting a worker orphans the expense row but doesn't destroy history.

ALTER TABLE public.expenses
  ADD COLUMN worker_id UUID REFERENCES public.workers(id) ON DELETE SET NULL;

ALTER TABLE public.expenses
  ADD CONSTRAINT expenses_worker_only_for_labor
  CHECK (worker_id IS NULL OR category = 'labor');

CREATE INDEX idx_expenses_worker_id
  ON public.expenses(worker_id) WHERE worker_id IS NOT NULL;
