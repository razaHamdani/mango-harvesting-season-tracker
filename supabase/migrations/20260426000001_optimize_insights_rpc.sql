-- ============================================================
-- Phase 3.3 — CTE optimisation for get_season_insights
--
-- The Phase 1 version (20260422050022) had 7 correlated
-- subqueries inside a single SELECT: expenses was scanned
-- twice (once for total, once for by-category) and
-- installments was scanned three times (paid sum, paid count,
-- total count).
--
-- This rewrite consolidates to 4 table scans via CTEs:
--   expense_amounts  → one pass over expenses
--   expense_agg      → aggregate from expense_amounts (no extra scan)
--   installment_agg  → one pass over installments (all three aggregates)
--   harvest_boxes    → one pass over activities (harvest only)
--   farm_acreage     → one pass over season_farms JOIN farms
--
-- CRITICAL: The Phase 1 ownership guard is preserved verbatim
-- at the top of the function body. It must stay there so a
-- non-owner PostgREST caller still gets SQLSTATE 42501.
--
-- Regression test (run after applying migration):
--   SELECT get_season_insights('<user_B_season_uuid>');
--   -- when called by user A → must raise 'Not authorized' (42501)
-- ============================================================

CREATE OR REPLACE FUNCTION get_season_insights(p_season_id UUID)
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    -- --------------------------------------------------------
    -- Ownership guard (verbatim from Phase 1 — do not remove).
    -- Caller must own the season; raises 42501 otherwise.
    -- --------------------------------------------------------
    IF NOT EXISTS (
        SELECT 1 FROM public.seasons
        WHERE id = p_season_id AND owner_id = auth.uid()
    ) THEN
        RAISE EXCEPTION 'Not authorized'
            USING ERRCODE = '42501';
    END IF;

    -- --------------------------------------------------------
    -- CTE-based aggregation: 4 table scans instead of 7.
    -- --------------------------------------------------------
    WITH
    -- One scan over expenses: per-category sums.
    expense_amounts AS (
        SELECT
            category,
            SUM(landlord_cost) AS cat_total
        FROM public.expenses
        WHERE season_id = p_season_id
        GROUP BY category
    ),
    -- Derive totals from expense_amounts (no extra scan).
    expense_agg AS (
        SELECT
            COALESCE(SUM(cat_total), 0)                              AS total_expenses,
            COALESCE(json_object_agg(category, cat_total), '{}'::json) AS expenses_by_category
        FROM expense_amounts
    ),
    -- One scan over installments: paid sum + paid count + total count.
    installment_agg AS (
        SELECT
            COALESCE(SUM(paid_amount), 0)                            AS total_payments_received,
            COUNT(*) FILTER (WHERE paid_amount IS NOT NULL)          AS installments_paid,
            COUNT(*)                                                  AS installments_total
        FROM public.installments
        WHERE season_id = p_season_id
    ),
    -- One scan over activities (harvest type only).
    harvest_boxes AS (
        SELECT COALESCE(SUM(boxes_collected), 0) AS boxes_received
        FROM public.activities
        WHERE season_id = p_season_id AND type = 'harvest'
    ),
    -- One scan over season_farms JOIN farms.
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
