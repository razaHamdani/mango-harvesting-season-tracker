BEGIN;

-- Seasons get a user-chosen date range.
--
-- * seasons.start_date / end_date (DATE, NOT NULL, start_date < end_date).
-- * A season's child records (activities.activity_date, expenses.expense_date,
--   installments.due_date and installments.paid_date) must fall inside
--   [start_date, end_date], inclusive — enforced by a BEFORE trigger.
-- * One owner can have several seasons per year, but their ranges cannot
--   overlap (exclusion constraint seasons_no_overlap). UNIQUE (owner_id, year)
--   is dropped; year stays as a label (the year of start_date).
-- * started_at (and its CHECK) is dropped: start_date replaces it.
-- * create_season_with_children takes p_start_date / p_end_date in place of
--   p_year. Both existing guards (caller = owner, farm ownership) are kept.
--
-- Backfill: start_date = the earlier of started_at (or Jan 1 of year) and the
-- earliest child date; end_date = the later of Dec 31 of year and the latest
-- child date — so every existing child record is inside its season's range.
-- If an owner's existing records spill so far outside their year that two
-- backfilled ranges overlap, adding seasons_no_overlap fails and the whole
-- migration rolls back; fix those rows by hand and re-run.

-- (a) daterange && with owner_id = needs btree_gist for the UUID equality.
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- (b) new columns
ALTER TABLE public.seasons ADD COLUMN start_date DATE;
ALTER TABLE public.seasons ADD COLUMN end_date DATE;

-- (c) backfill
WITH child_dates AS (
  SELECT season_id, activity_date AS d FROM public.activities
  UNION ALL
  SELECT season_id, expense_date FROM public.expenses
  UNION ALL
  SELECT season_id, due_date FROM public.installments
  UNION ALL
  SELECT season_id, paid_date FROM public.installments WHERE paid_date IS NOT NULL
),
bounds AS (
  SELECT season_id, MIN(d) AS min_d, MAX(d) AS max_d
  FROM child_dates
  GROUP BY season_id
)
UPDATE public.seasons s
SET start_date = LEAST(COALESCE(s.started_at, make_date(s.year, 1, 1)), b.min_d),
    end_date   = GREATEST(make_date(s.year, 12, 31), b.max_d)
FROM public.seasons s2
LEFT JOIN bounds b ON b.season_id = s2.id
WHERE s2.id = s.id;

-- (d) required
ALTER TABLE public.seasons ALTER COLUMN start_date SET NOT NULL;
ALTER TABLE public.seasons ALTER COLUMN end_date SET NOT NULL;

-- (e) order
ALTER TABLE public.seasons
  ADD CONSTRAINT seasons_date_order CHECK (start_date < end_date);

-- (f) several seasons per year are now allowed
ALTER TABLE public.seasons DROP CONSTRAINT IF EXISTS seasons_owner_id_year_key;

-- (g) started_at is replaced by start_date
ALTER TABLE public.seasons DROP CONSTRAINT IF EXISTS seasons_started_at_required;
ALTER TABLE public.seasons DROP COLUMN IF EXISTS started_at;

-- (h) one owner's seasons cannot overlap (inclusive bounds)
ALTER TABLE public.seasons
  ADD CONSTRAINT seasons_no_overlap
  EXCLUDE USING gist (owner_id WITH =, daterange(start_date, end_date, '[]') WITH &&);

-- Child dates must fall inside the season's range.
-- SECURITY INVOKER: the caller's RLS lets an owner read their own seasons.
-- A season the caller cannot see yields no row; the insert is then left to
-- the FK / RLS WITH CHECK to reject, and no other owner's dates are revealed.
CREATE OR REPLACE FUNCTION public.enforce_season_date_range()
RETURNS TRIGGER AS $$
DECLARE
    v_start DATE;
    v_end   DATE;
BEGIN
    SELECT start_date, end_date INTO v_start, v_end
    FROM public.seasons
    WHERE id = NEW.season_id;

    IF NOT FOUND THEN
        RETURN NEW;
    END IF;

    IF TG_TABLE_NAME = 'activities' THEN
        IF NEW.activity_date < v_start OR NEW.activity_date > v_end THEN
            RAISE EXCEPTION 'activity_date % is outside season date range [%, %]',
                NEW.activity_date, v_start, v_end
                USING ERRCODE = '23514';
        END IF;
    ELSIF TG_TABLE_NAME = 'expenses' THEN
        IF NEW.expense_date < v_start OR NEW.expense_date > v_end THEN
            RAISE EXCEPTION 'expense_date % is outside season date range [%, %]',
                NEW.expense_date, v_start, v_end
                USING ERRCODE = '23514';
        END IF;
    ELSIF TG_TABLE_NAME = 'installments' THEN
        IF NEW.due_date < v_start OR NEW.due_date > v_end THEN
            RAISE EXCEPTION 'due_date % is outside season date range [%, %]',
                NEW.due_date, v_start, v_end
                USING ERRCODE = '23514';
        END IF;
        IF NEW.paid_date IS NOT NULL
           AND (NEW.paid_date < v_start OR NEW.paid_date > v_end) THEN
            RAISE EXCEPTION 'paid_date % is outside season date range [%, %]',
                NEW.paid_date, v_start, v_end
                USING ERRCODE = '23514';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER SET search_path = public;

CREATE TRIGGER activities_season_date_range
  BEFORE INSERT OR UPDATE ON public.activities
  FOR EACH ROW EXECUTE FUNCTION public.enforce_season_date_range();

CREATE TRIGGER expenses_season_date_range
  BEFORE INSERT OR UPDATE ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION public.enforce_season_date_range();

CREATE TRIGGER installments_season_date_range
  BEFORE INSERT OR UPDATE ON public.installments
  FOR EACH ROW EXECUTE FUNCTION public.enforce_season_date_range();

-- RPC: p_year -> p_start_date, p_end_date. The signature changes, so the old
-- function is dropped (CREATE OR REPLACE would add an overload). The old one
-- had no explicit GRANT (default EXECUTE to PUBLIC), so none is re-applied.
DROP FUNCTION IF EXISTS public.create_season_with_children(
    UUID, INTEGER, TEXT, TEXT, TEXT, DECIMAL, INTEGER, INTEGER, INTEGER, UUID[], JSONB
);

CREATE FUNCTION public.create_season_with_children(
    p_owner_id UUID,
    p_start_date DATE,
    p_end_date DATE,
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
        owner_id, year, start_date, end_date, status, contractor_name,
        contractor_phone, contractor_cnic, predetermined_amount,
        spray_landlord_pct, fertilizer_landlord_pct, agreed_boxes
    ) VALUES (
        p_owner_id, EXTRACT(YEAR FROM p_start_date)::int, p_start_date, p_end_date,
        'draft', p_contractor_name, p_contractor_phone, p_contractor_cnic,
        p_predetermined_amount, p_spray_landlord_pct, p_fertilizer_landlord_pct,
        p_agreed_boxes
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

COMMIT;

-- ROLLBACK: to revert, create a follow-up migration with (fails if an owner
-- now has two seasons in one year — merge or delete those first):
-- DROP FUNCTION IF EXISTS public.create_season_with_children(
--     UUID, DATE, DATE, TEXT, TEXT, TEXT, DECIMAL, INTEGER, INTEGER, INTEGER, UUID[], JSONB);
-- -- then re-create the p_year version from 20260427093750_verify_farm_ownership_in_rpc.sql
-- DROP TRIGGER IF EXISTS activities_season_date_range ON public.activities;
-- DROP TRIGGER IF EXISTS expenses_season_date_range ON public.expenses;
-- DROP TRIGGER IF EXISTS installments_season_date_range ON public.installments;
-- DROP FUNCTION IF EXISTS public.enforce_season_date_range();
-- ALTER TABLE public.seasons DROP CONSTRAINT IF EXISTS seasons_no_overlap;
-- ALTER TABLE public.seasons ADD COLUMN started_at DATE;
-- UPDATE public.seasons SET started_at = start_date WHERE status <> 'draft';
-- ALTER TABLE public.seasons
--   ADD CONSTRAINT seasons_started_at_required
--   CHECK (status = 'draft' OR started_at IS NOT NULL);
-- ALTER TABLE public.seasons ADD CONSTRAINT seasons_owner_id_year_key UNIQUE (owner_id, year);
-- ALTER TABLE public.seasons DROP CONSTRAINT IF EXISTS seasons_date_order;
-- ALTER TABLE public.seasons DROP COLUMN start_date;
-- ALTER TABLE public.seasons DROP COLUMN end_date;
