-- Migration: 20260427093750_verify_farm_ownership_in_rpc.sql
--
-- Fix: create_season_with_children did not verify that every farm_id in
-- p_farm_ids is owned by the calling user. A logged-in user could supply
-- another user's valid farm UUID and successfully link it to their season.
--
-- Fix: add an ownership pre-check before the season_farms insert. If any
-- farm_id is not owned by auth.uid(), the whole transaction is aborted with
-- a 42501 (insufficient_privilege) error, consistent with the auth check at
-- the top of the function.
--
-- The Phase 1 auth.uid() == p_owner_id guard and the rest of the function
-- body are preserved verbatim.

CREATE OR REPLACE FUNCTION create_season_with_children(
    p_owner_id UUID,
    p_year INTEGER,
    p_contractor_name TEXT,
    p_contractor_phone TEXT,
    p_contractor_cnic TEXT,
    p_predetermined_amount DECIMAL,
    p_spray_landlord_pct INTEGER,
    p_fertilizer_landlord_pct INTEGER,
    p_agreed_boxes INTEGER,
    p_farm_ids UUID[],
    p_installments JSONB
) RETURNS UUID AS $$
DECLARE
    v_season_id UUID;
BEGIN
    -- Caller must match p_owner_id (defense in depth; RLS would also block)
    IF auth.uid() IS NULL OR auth.uid() <> p_owner_id THEN
        RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
    END IF;

    -- Verify every supplied farm_id is owned by the calling user.
    -- Prevents cross-user farm linkage even though the FK and season_farms
    -- RLS only check season ownership, not farm ownership.
    IF EXISTS (
        SELECT 1
        FROM unnest(p_farm_ids) AS fid
        WHERE fid NOT IN (
            SELECT id FROM public.farms WHERE owner_id = auth.uid()
        )
    ) THEN
        RAISE EXCEPTION 'One or more farm IDs are not owned by the caller'
            USING ERRCODE = '42501';
    END IF;

    INSERT INTO seasons (
        owner_id, year, status, contractor_name, contractor_phone,
        contractor_cnic, predetermined_amount, spray_landlord_pct,
        fertilizer_landlord_pct, agreed_boxes
    ) VALUES (
        p_owner_id, p_year, 'draft', p_contractor_name, p_contractor_phone,
        p_contractor_cnic, p_predetermined_amount, p_spray_landlord_pct,
        p_fertilizer_landlord_pct, p_agreed_boxes
    ) RETURNING id INTO v_season_id;

    INSERT INTO season_farms (season_id, farm_id)
    SELECT v_season_id, unnest(p_farm_ids);

    INSERT INTO installments (season_id, installment_number, expected_amount, due_date)
    SELECT
        v_season_id,
        (ord)::int,
        (elem->>'amount')::decimal,
        (elem->>'due_date')::date
    FROM jsonb_array_elements(p_installments) WITH ORDINALITY AS t(elem, ord);

    RETURN v_season_id;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER;
