-- Phase 10 — capture the activation moment as the season's business start date.
-- Used by app-level guards in createActivity / createExpense / recordPayment to
-- reject child records dated before the season began.

ALTER TABLE public.seasons ADD COLUMN started_at DATE;

ALTER TABLE public.seasons
  ADD CONSTRAINT seasons_started_at_required
  CHECK (status = 'draft' OR started_at IS NOT NULL);
