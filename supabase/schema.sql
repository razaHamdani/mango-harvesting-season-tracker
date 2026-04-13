-- Aam Daata - Complete Database Schema
-- Paste this entire script into the Supabase SQL Editor and run it.

-- ============================================================
-- TABLES
-- ============================================================

CREATE TABLE public.profiles (
  id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name  TEXT NOT NULL,
  email      TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.farms (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id   UUID NOT NULL REFERENCES public.profiles(id),
  name       TEXT NOT NULL,
  acreage    DECIMAL(8,2) NOT NULL CHECK (acreage > 0),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.seasons (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id              UUID NOT NULL REFERENCES public.profiles(id),
  year                  INTEGER NOT NULL CHECK (year BETWEEN 2020 AND 2100),
  status                TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'closed')),
  contractor_name       TEXT NOT NULL,
  contractor_phone      TEXT,
  contractor_cnic       TEXT,
  predetermined_amount  DECIMAL(12,2) NOT NULL CHECK (predetermined_amount > 0),
  spray_landlord_pct    INTEGER NOT NULL DEFAULT 100 CHECK (spray_landlord_pct BETWEEN 0 AND 100),
  fertilizer_landlord_pct INTEGER NOT NULL DEFAULT 100 CHECK (fertilizer_landlord_pct BETWEEN 0 AND 100),
  agreed_boxes          INTEGER NOT NULL DEFAULT 0 CHECK (agreed_boxes >= 0),
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  closed_at             TIMESTAMPTZ,
  UNIQUE (owner_id, year)
);

CREATE UNIQUE INDEX one_active_season_per_owner
  ON public.seasons (owner_id)
  WHERE status = 'active';

CREATE TABLE public.season_farms (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id UUID NOT NULL REFERENCES public.seasons(id) ON DELETE CASCADE,
  farm_id   UUID NOT NULL REFERENCES public.farms(id),
  UNIQUE (season_id, farm_id)
);

CREATE TABLE public.installments (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id          UUID NOT NULL REFERENCES public.seasons(id) ON DELETE CASCADE,
  installment_number INTEGER NOT NULL,
  expected_amount    DECIMAL(12,2) NOT NULL CHECK (expected_amount > 0),
  due_date           DATE NOT NULL,
  paid_amount        DECIMAL(12,2),
  paid_date          DATE,
  receipt_photo_path TEXT,
  notes              TEXT,
  created_at         TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (season_id, installment_number)
);

CREATE TABLE public.activities (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id       UUID NOT NULL REFERENCES public.seasons(id) ON DELETE CASCADE,
  farm_id         UUID NOT NULL REFERENCES public.farms(id),
  type            TEXT NOT NULL CHECK (type IN ('spray', 'water', 'fertilize', 'harvest')),
  activity_date   DATE NOT NULL,
  item_name       TEXT,
  meter_reading   DECIMAL(10,2),
  boxes_collected INTEGER CHECK (boxes_collected >= 0),
  description     TEXT,
  photo_path      TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.expenses (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id          UUID NOT NULL REFERENCES public.seasons(id) ON DELETE CASCADE,
  farm_id            UUID REFERENCES public.farms(id),
  category           TEXT NOT NULL CHECK (category IN ('electricity', 'spray', 'fertilizer', 'labor', 'misc')),
  amount             DECIMAL(12,2) NOT NULL CHECK (amount > 0),
  landlord_cost      DECIMAL(12,2) NOT NULL,
  expense_date       DATE NOT NULL,
  description        TEXT,
  photo_path         TEXT,
  linked_activity_id UUID REFERENCES public.activities(id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.workers (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id       UUID NOT NULL REFERENCES public.profiles(id),
  name           TEXT NOT NULL,
  phone          TEXT,
  monthly_salary DECIMAL(10,2) CHECK (monthly_salary > 0),
  is_active      BOOLEAN DEFAULT TRUE,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX idx_activities_season          ON public.activities(season_id);
CREATE INDEX idx_activities_season_type     ON public.activities(season_id, type);
CREATE INDEX idx_expenses_season            ON public.expenses(season_id);
CREATE INDEX idx_expenses_season_category   ON public.expenses(season_id, category);
CREATE INDEX idx_installments_season        ON public.installments(season_id);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE public.profiles     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.farms        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seasons      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.season_farms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.installments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activities   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workers      ENABLE ROW LEVEL SECURITY;

-- profiles: owner can CRUD their own row
CREATE POLICY "Users can manage own profile"
  ON public.profiles FOR ALL
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- farms: owner can CRUD their own farms
CREATE POLICY "Users can manage own farms"
  ON public.farms FOR ALL
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- seasons: owner can CRUD their own seasons
CREATE POLICY "Users can manage own seasons"
  ON public.seasons FOR ALL
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- workers: owner can CRUD their own workers
CREATE POLICY "Users can manage own workers"
  ON public.workers FOR ALL
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- season_farms: access via season ownership
CREATE POLICY "Users can manage own season_farms"
  ON public.season_farms FOR ALL
  USING (season_id IN (SELECT id FROM public.seasons WHERE owner_id = auth.uid()))
  WITH CHECK (season_id IN (SELECT id FROM public.seasons WHERE owner_id = auth.uid()));

-- installments: access via season ownership
CREATE POLICY "Users can manage own installments"
  ON public.installments FOR ALL
  USING (season_id IN (SELECT id FROM public.seasons WHERE owner_id = auth.uid()))
  WITH CHECK (season_id IN (SELECT id FROM public.seasons WHERE owner_id = auth.uid()));

-- activities: access via season ownership
CREATE POLICY "Users can manage own activities"
  ON public.activities FOR ALL
  USING (season_id IN (SELECT id FROM public.seasons WHERE owner_id = auth.uid()))
  WITH CHECK (season_id IN (SELECT id FROM public.seasons WHERE owner_id = auth.uid()));

-- expenses: access via season ownership
CREATE POLICY "Users can manage own expenses"
  ON public.expenses FOR ALL
  USING (season_id IN (SELECT id FROM public.seasons WHERE owner_id = auth.uid()))
  WITH CHECK (season_id IN (SELECT id FROM public.seasons WHERE owner_id = auth.uid()));

-- ============================================================
-- AUTH TRIGGER: auto-create profile on signup
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (new.id, COALESCE(new.raw_user_meta_data->>'full_name', ''), new.email);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- RPC: Season Insights
-- ============================================================

CREATE OR REPLACE FUNCTION get_season_insights(p_season_id UUID)
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
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
$$ LANGUAGE plpgsql SECURITY DEFINER;
