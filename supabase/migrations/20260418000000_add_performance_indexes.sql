-- Performance indexes for hot query paths.

-- RLS subquery: seasons(owner_id = auth.uid()) runs on every row of child tables.
CREATE INDEX IF NOT EXISTS idx_seasons_owner        ON public.seasons(owner_id);
CREATE INDEX IF NOT EXISTS idx_seasons_owner_status ON public.seasons(owner_id, status);

-- Activities list: filter by season_id, order by activity_date DESC.
CREATE INDEX IF NOT EXISTS idx_activities_date ON public.activities(season_id, activity_date DESC);
CREATE INDEX IF NOT EXISTS idx_activities_farm ON public.activities(farm_id);

-- Expenses list: filter by season_id, order by expense_date DESC.
CREATE INDEX IF NOT EXISTS idx_expenses_date ON public.expenses(season_id, expense_date DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_farm ON public.expenses(farm_id);

-- Installments lookup by season.
CREATE INDEX IF NOT EXISTS idx_installments_season ON public.installments(season_id);
