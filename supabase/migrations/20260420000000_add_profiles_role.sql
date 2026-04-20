-- Add role, phone, updated_at to the existing profiles table.
-- Also replaces the auto-create trigger so new signups get role='landlord',
-- and adds a trigger to prevent users from self-elevating their own role.

-- 1. New columns
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS role       TEXT NOT NULL DEFAULT 'landlord'
    CHECK (role IN ('landlord', 'contractor', 'admin')),
  ADD COLUMN IF NOT EXISTS phone      TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- 2. Backfill existing users (role already defaults to 'landlord'; this is a no-op
--    for the role column, but sets updated_at on existing rows)
UPDATE public.profiles SET updated_at = created_at WHERE updated_at = now();

-- 3. Replace the auto-create trigger so it still works after schema change.
--    The trigger body doesn't reference role — the column default handles it.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', ''),
    new.email
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Re-create trigger (DROP IF EXISTS + CREATE is cleaner than OR REPLACE on triggers)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 4. Role-guard trigger: blocks users from changing their own role.
--    Only service-role connections (admin API, migrations) can change roles.
CREATE OR REPLACE FUNCTION public.prevent_role_self_edit()
RETURNS TRIGGER AS $$
BEGIN
  IF new.role IS DISTINCT FROM old.role
     AND COALESCE(auth.jwt()->>'role', '') <> 'service_role' THEN
    RAISE EXCEPTION 'role can only be changed by admin/service';
  END IF;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS profiles_guard_role ON public.profiles;
CREATE TRIGGER profiles_guard_role
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_role_self_edit();
