-- ============================================================
-- Phase 3.8 — Rewrite RLS policies from IN(subquery) to EXISTS
--
-- The original policies used:
--   season_id IN (SELECT id FROM public.seasons WHERE owner_id = auth.uid())
--
-- EXISTS is preferred because:
-- 1. Postgres can short-circuit on first matching row (no full subquery scan).
-- 2. The correlated form allows the planner to use the index on
--    seasons(owner_id) efficiently, joining on id via PK lookup.
-- 3. Prevents accidental NULL semantics: IN returns NULL (not FALSE)
--    when the subquery contains NULLs; EXISTS always returns TRUE/FALSE.
--
-- Tables affected: season_farms, installments, activities, expenses
-- Tables NOT affected: seasons, workers (already use direct owner_id = auth.uid())
-- ============================================================

-- season_farms
DROP POLICY IF EXISTS "Users can manage own season_farms" ON public.season_farms;
CREATE POLICY "Users can manage own season_farms"
  ON public.season_farms FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.seasons
      WHERE id = season_farms.season_id
        AND owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.seasons
      WHERE id = season_farms.season_id
        AND owner_id = auth.uid()
    )
  );

-- installments
DROP POLICY IF EXISTS "Users can manage own installments" ON public.installments;
CREATE POLICY "Users can manage own installments"
  ON public.installments FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.seasons
      WHERE id = installments.season_id
        AND owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.seasons
      WHERE id = installments.season_id
        AND owner_id = auth.uid()
    )
  );

-- activities
DROP POLICY IF EXISTS "Users can manage own activities" ON public.activities;
CREATE POLICY "Users can manage own activities"
  ON public.activities FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.seasons
      WHERE id = activities.season_id
        AND owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.seasons
      WHERE id = activities.season_id
        AND owner_id = auth.uid()
    )
  );

-- expenses
DROP POLICY IF EXISTS "Users can manage own expenses" ON public.expenses;
CREATE POLICY "Users can manage own expenses"
  ON public.expenses FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.seasons
      WHERE id = expenses.season_id
        AND owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.seasons
      WHERE id = expenses.season_id
        AND owner_id = auth.uid()
    )
  );
