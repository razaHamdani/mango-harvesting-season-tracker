-- ============================================================
-- Phase 1.1 — Secure get_season_insights
--
-- The previous definition (initial schema, line ~195) is
-- SECURITY DEFINER with no caller-ownership check. Because
-- Supabase exposes RPCs directly via PostgREST, any
-- authenticated user could call this function with any
-- season UUID and read the full financial picture of that
-- season (predetermined amount, expenses, payments, etc.).
--
-- Fix: keep SECURITY DEFINER (avoids per-subquery RLS
-- overhead) but add an explicit auth.uid() ownership guard at
-- the top of the function body. A non-owner (or unauthenticated
-- caller) now hits RAISE EXCEPTION with SQLSTATE 42501.
--
-- search_path is pinned to public so a malicious search_path
-- cannot shadow `seasons` during the check.
-- ============================================================

CREATE OR REPLACE FUNCTION get_season_insights(p_season_id UUID)
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    -- Ownership guard: caller must own the season.
    IF NOT EXISTS (
        SELECT 1 FROM public.seasons
        WHERE id = p_season_id AND owner_id = auth.uid()
    ) THEN
        RAISE EXCEPTION 'Not authorized'
            USING ERRCODE = '42501';
    END IF;

    SELECT json_build_object(
        'predetermined_amount', s.predetermined_amount,
        'total_acreage', (
            SELECT COALESCE(SUM(f.acreage), 0)
            FROM season_farms sf JOIN farms f ON sf.farm_id = f.id
            WHERE sf.season_id = p_season_id
        ),
        'agreed_boxes', s.agreed_boxes,
        'boxes_received', (
            SELECT COALESCE(SUM(a.boxes_collected), 0)
            FROM activities a
            WHERE a.season_id = p_season_id AND a.type = 'harvest'
        ),
        'total_expenses', (
            SELECT COALESCE(SUM(e.landlord_cost), 0)
            FROM expenses e WHERE e.season_id = p_season_id
        ),
        'expenses_by_category', (
            SELECT COALESCE(json_object_agg(category, cat_total), '{}'::json)
            FROM (
                SELECT category, SUM(landlord_cost) as cat_total
                FROM expenses WHERE season_id = p_season_id
                GROUP BY category
            ) sub
        ),
        'total_payments_received', (
            SELECT COALESCE(SUM(paid_amount), 0)
            FROM installments WHERE season_id = p_season_id AND paid_amount IS NOT NULL
        ),
        'installments_paid', (
            SELECT COUNT(*) FROM installments
            WHERE season_id = p_season_id AND paid_amount IS NOT NULL
        ),
        'installments_total', (
            SELECT COUNT(*) FROM installments WHERE season_id = p_season_id
        )
    ) INTO result
    FROM seasons s WHERE s.id = p_season_id;

    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
