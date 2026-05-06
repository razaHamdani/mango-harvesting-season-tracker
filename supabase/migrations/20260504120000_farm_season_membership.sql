BEGIN;

-- Phase 11A: Bind farm_id to season_farms in RLS WITH CHECK clauses.
-- USING clauses (read access) are unchanged — season ownership still gates reads.
-- WITH CHECK clauses (write access) now additionally require farm_id ∈ season_farms
-- for the same season, closing a cross-tenant FK reference gap.

-- activities: farm_id is NOT NULL, must belong to season_farms for the same season
DROP POLICY IF EXISTS "Users can manage own activities" ON public.activities;
CREATE POLICY "Users can manage own activities"
  ON public.activities FOR ALL
  USING (
    season_id IN (SELECT id FROM public.seasons WHERE owner_id = auth.uid())
  )
  WITH CHECK (
    season_id IN (SELECT id FROM public.seasons WHERE owner_id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.season_farms sf
      WHERE sf.season_id = activities.season_id
        AND sf.farm_id   = activities.farm_id
    )
  );

-- expenses: farm_id is optional (nullable), but if present must belong to season_farms
DROP POLICY IF EXISTS "Users can manage own expenses" ON public.expenses;
CREATE POLICY "Users can manage own expenses"
  ON public.expenses FOR ALL
  USING (
    season_id IN (SELECT id FROM public.seasons WHERE owner_id = auth.uid())
  )
  WITH CHECK (
    season_id IN (SELECT id FROM public.seasons WHERE owner_id = auth.uid())
    AND (
      farm_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.season_farms sf
        WHERE sf.season_id = expenses.season_id
          AND sf.farm_id   = expenses.farm_id
      )
    )
  );

COMMIT;

-- ROLLBACK: to revert to season-only WITH CHECK, create a follow-up migration with:
-- DROP POLICY IF EXISTS "Users can manage own activities" ON public.activities;
-- CREATE POLICY "Users can manage own activities"
--   ON public.activities FOR ALL
--   USING (season_id IN (SELECT id FROM public.seasons WHERE owner_id = auth.uid()))
--   WITH CHECK (season_id IN (SELECT id FROM public.seasons WHERE owner_id = auth.uid()));
--
-- DROP POLICY IF EXISTS "Users can manage own expenses" ON public.expenses;
-- CREATE POLICY "Users can manage own expenses"
--   ON public.expenses FOR ALL
--   USING (season_id IN (SELECT id FROM public.seasons WHERE owner_id = auth.uid()))
--   WITH CHECK (season_id IN (SELECT id FROM public.seasons WHERE owner_id = auth.uid()));
