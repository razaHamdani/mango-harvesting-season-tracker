-- ============================================================
-- Drop worker_salaries from get_season_insights.
--
-- The insights "Per-acre metrics" no longer surfaces a separate
-- "Salaries / Acre" figure. Instead it maps 1:1 to expense
-- categories (spray, electricity, fertilizer, labor, misc), all of
-- which are already returned in expenses_by_category. The labor
-- category total now covers both salaried workers and casual labor.
--
-- This removes the now-dead salary_total / worker_salaries plumbing.
-- Ownership guard and SECURITY DEFINER attributes preserved verbatim.
-- ============================================================

CREATE OR REPLACE FUNCTION get_season_insights(p_season_id UUID)
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM public.seasons
        WHERE id = p_season_id AND owner_id = auth.uid()
    ) THEN
        RAISE EXCEPTION 'Not authorized'
            USING ERRCODE = '42501';
    END IF;

    WITH
    expense_amounts AS (
        SELECT
            category,
            SUM(landlord_cost) AS cat_total
        FROM public.expenses
        WHERE season_id = p_season_id
        GROUP BY category
    ),
    expense_agg AS (
        SELECT
            COALESCE(SUM(cat_total), 0)                                AS total_expenses,
            COALESCE(json_object_agg(category, cat_total), '{}'::json) AS expenses_by_category
        FROM expense_amounts
    ),
    installment_agg AS (
        SELECT
            COALESCE(SUM(paid_amount), 0)                        AS total_payments_received,
            COUNT(*) FILTER (WHERE paid_amount IS NOT NULL)      AS installments_paid,
            COUNT(*)                                             AS installments_total
        FROM public.installments
        WHERE season_id = p_season_id
    ),
    harvest_boxes AS (
        SELECT COALESCE(SUM(boxes_collected), 0) AS boxes_received
        FROM public.activities
        WHERE season_id = p_season_id AND type = 'harvest'
    ),
    farm_acreage AS (
        SELECT COALESCE(SUM(f.acreage), 0) AS total_acreage
        FROM public.season_farms sf
        JOIN public.farms f ON sf.farm_id = f.id
        WHERE sf.season_id = p_season_id
    )
    SELECT json_build_object(
        'predetermined_amount',     s.predetermined_amount,
        'total_acreage',            fa.total_acreage,
        'agreed_boxes',             s.agreed_boxes,
        'boxes_received',           hb.boxes_received,
        'total_expenses',           ea.total_expenses,
        'expenses_by_category',     ea.expenses_by_category,
        'total_payments_received',  ia.total_payments_received,
        'installments_paid',        ia.installments_paid,
        'installments_total',       ia.installments_total
    ) INTO result
    FROM
        public.seasons s,
        expense_agg    ea,
        installment_agg ia,
        harvest_boxes  hb,
        farm_acreage   fa
    WHERE s.id = p_season_id;

    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
