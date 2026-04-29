-- ============================================================
-- Phase 5B.4 — Partial index for upcoming-installments query
--
-- The dashboard's `upcomingInstallments` query (season-queries.ts:209)
-- selects installments WHERE season_id = ? AND paid_amount IS NULL
-- ORDER BY due_date.
--
-- The existing idx_installments_season covers the equality but the
-- planner has to sort the unpaid set in memory. A partial index keyed
-- on (season_id, due_date) restricted to unpaid rows lets the dashboard
-- read the top-5 directly via index scan with no sort.
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_installments_season_due_date
  ON public.installments (season_id, due_date)
  WHERE paid_amount IS NULL;
