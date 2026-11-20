-- A closed season is frozen in the database, not only in the app.
--
-- * activities, expenses, installments, season_farms: no INSERT, UPDATE or
--   DELETE while their season is closed. An UPDATE that moves a row between
--   seasons checks both the source and the destination season.
-- * seasons: a closed season's row cannot be updated. Deleting a whole
--   closed season stays allowed; its children go with the ON DELETE CASCADE.
-- * Errors use SQLSTATE 55000 (object_not_in_prerequisite_state); the server
--   actions map it to "This season is closed."
--
-- Race with closing: the child trigger takes FOR SHARE on the season row,
-- which conflicts with the row lock taken by closeSeason's UPDATE. A child
-- write and a close of the same season therefore run one after the other,
-- and a writer that waited re-reads the committed status (READ COMMITTED).
-- Season ids are locked in id order so a move between seasons cannot
-- deadlock against another.
--
-- SECURITY DEFINER: the function's owner (postgres) owns these tables and
-- RLS is not forced, so its read ignores RLS. A season the caller cannot see
-- is still found, and "not found" only means the season row is already gone,
-- which the foreign key allows only when it was deleted earlier in this
-- transaction (the cascade of a season delete). That case is allowed.
--
-- Also (owner decision D7): installments.paid_date may fall after the
-- season's end_date — contractors pay after harvest. It must still be on or
-- after start_date. due_date keeps both bounds.

CREATE OR REPLACE FUNCTION public.enforce_closed_season()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_ids    UUID[];
    v_status TEXT;
BEGIN
    IF TG_OP = 'INSERT' THEN
        v_ids := ARRAY[NEW.season_id];
    ELSIF TG_OP = 'DELETE' THEN
        v_ids := ARRAY[OLD.season_id];
    ELSIF NEW.season_id IS DISTINCT FROM OLD.season_id THEN
        v_ids := ARRAY[OLD.season_id, NEW.season_id];
    ELSE
        v_ids := ARRAY[OLD.season_id];
    END IF;

    FOR v_status IN
        SELECT status FROM public.seasons
        WHERE id = ANY (v_ids)
        ORDER BY id
        FOR SHARE
    LOOP
        IF v_status = 'closed' THEN
            RAISE EXCEPTION 'season is closed'
                USING ERRCODE = '55000';
        END IF;
    END LOOP;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER activities_closed_season
  BEFORE INSERT OR UPDATE OR DELETE ON public.activities
  FOR EACH ROW EXECUTE FUNCTION public.enforce_closed_season();

CREATE TRIGGER expenses_closed_season
  BEFORE INSERT OR UPDATE OR DELETE ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION public.enforce_closed_season();

CREATE TRIGGER installments_closed_season
  BEFORE INSERT OR UPDATE OR DELETE ON public.installments
  FOR EACH ROW EXECUTE FUNCTION public.enforce_closed_season();

CREATE TRIGGER season_farms_closed_season
  BEFORE INSERT OR UPDATE OR DELETE ON public.season_farms
  FOR EACH ROW EXECUTE FUNCTION public.enforce_closed_season();

-- The closed season's own row.
CREATE OR REPLACE FUNCTION public.enforce_closed_season_row()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
    IF OLD.status = 'closed' THEN
        RAISE EXCEPTION 'season is closed'
            USING ERRCODE = '55000';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER seasons_closed_frozen
  BEFORE UPDATE ON public.seasons
  FOR EACH ROW EXECUTE FUNCTION public.enforce_closed_season_row();

-- Date range: same as 20261114120000_season_date_range.sql, except that
-- paid_date no longer has an upper bound (D7).
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
        IF NEW.paid_date IS NOT NULL AND NEW.paid_date < v_start THEN
            RAISE EXCEPTION 'paid_date % is before season start %',
                NEW.paid_date, v_start
                USING ERRCODE = '23514';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER SET search_path = public;

-- ROLLBACK: create a follow-up migration with:
-- DROP TRIGGER IF EXISTS activities_closed_season ON public.activities;
-- DROP TRIGGER IF EXISTS expenses_closed_season ON public.expenses;
-- DROP TRIGGER IF EXISTS installments_closed_season ON public.installments;
-- DROP TRIGGER IF EXISTS season_farms_closed_season ON public.season_farms;
-- DROP TRIGGER IF EXISTS seasons_closed_frozen ON public.seasons;
-- -- safety: allow-destructive rollback of 20261120120000_closed_season_frozen
-- DROP FUNCTION IF EXISTS public.enforce_closed_season();
-- DROP FUNCTION IF EXISTS public.enforce_closed_season_row();
-- and CREATE OR REPLACE public.enforce_season_date_range() with the body from
-- 20261114120000_season_date_range.sql (restores paid_date <= end_date).
