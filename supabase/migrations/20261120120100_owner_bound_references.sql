-- A season may only reference farms and workers owned by the caller.
--
-- * season_farms: the farm must belong to the caller, on INSERT and UPDATE.
--   The existing policy checked only that the caller owns the season, so
--   anyone who knew another user's farm id could link it to their own season.
-- * expenses.worker_id: if set, the worker must belong to the caller, on
--   INSERT and UPDATE.
--
-- These are RESTRICTIVE policies: Postgres ANDs them with every permissive
-- policy on the table, so a permissive policy added later cannot bypass
-- them. service_role and SECURITY DEFINER functions bypass RLS as before;
-- create_season_with_children is SECURITY INVOKER, so these apply to it too
-- (its callers own their farms, and it checks farm ownership itself).
--
-- Existing rows are not re-checked. The owner confirmed before release that
-- production has no cross-owner season_farms or expenses.worker_id rows.

DROP POLICY IF EXISTS "season_farms: farm owned by caller (insert)" ON public.season_farms;
CREATE POLICY "season_farms: farm owned by caller (insert)"
  ON public.season_farms
  AS RESTRICTIVE
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.farms f
      WHERE f.id = season_farms.farm_id
        AND f.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "season_farms: farm owned by caller (update)" ON public.season_farms;
CREATE POLICY "season_farms: farm owned by caller (update)"
  ON public.season_farms
  AS RESTRICTIVE
  FOR UPDATE
  USING (true)
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.farms f
      WHERE f.id = season_farms.farm_id
        AND f.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "expenses: worker owned by caller (insert)" ON public.expenses;
CREATE POLICY "expenses: worker owned by caller (insert)"
  ON public.expenses
  AS RESTRICTIVE
  FOR INSERT
  WITH CHECK (
    worker_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.workers w
      WHERE w.id = expenses.worker_id
        AND w.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "expenses: worker owned by caller (update)" ON public.expenses;
CREATE POLICY "expenses: worker owned by caller (update)"
  ON public.expenses
  AS RESTRICTIVE
  FOR UPDATE
  USING (true)
  WITH CHECK (
    worker_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.workers w
      WHERE w.id = expenses.worker_id
        AND w.owner_id = auth.uid()
    )
  );

-- ROLLBACK: create a follow-up migration with:
-- DROP POLICY IF EXISTS "season_farms: farm owned by caller (insert)" ON public.season_farms;
-- DROP POLICY IF EXISTS "season_farms: farm owned by caller (update)" ON public.season_farms;
-- DROP POLICY IF EXISTS "expenses: worker owned by caller (insert)" ON public.expenses;
-- DROP POLICY IF EXISTS "expenses: worker owned by caller (update)" ON public.expenses;
