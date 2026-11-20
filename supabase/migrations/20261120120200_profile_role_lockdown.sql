-- Nobody can make themselves admin.
--
-- 1. handle_new_user ignores the role in signup metadata: every new profile
--    is 'landlord' (the only role the app offers, auth-actions.ts).
-- 2. The FOR ALL profiles policy let a user DELETE their own profile and
--    INSERT it again with role = 'admin' (prevent_role_self_edit guards
--    UPDATE only). It is replaced by SELECT, UPDATE and an INSERT that only
--    accepts role = 'landlord' (kept for ensureProfile's insert-or-ignore).
--    No DELETE policy: profiles go only with their auth.users row (cascade).
-- 3. Column privileges: signed-in users may update only full_name, phone and
--    updated_at. prevent_role_self_edit stays as a second layer.
--
-- No existing role is changed. profiles.role is an app-level label: no RLS
-- policy or function grants anything based on it, and it is not a Postgres
-- role.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, role)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', ''),
    new.email,
    'landlord'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP POLICY IF EXISTS "Users can manage own profile" ON public.profiles;

DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
CREATE POLICY "Users can read own profile"
  ON public.profiles FOR SELECT
  USING (id = auth.uid());

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "Users can insert own landlord profile" ON public.profiles;
CREATE POLICY "Users can insert own landlord profile"
  ON public.profiles FOR INSERT
  WITH CHECK (id = auth.uid() AND role = 'landlord');

REVOKE UPDATE ON public.profiles FROM anon, authenticated;
GRANT UPDATE (full_name, phone, updated_at) ON public.profiles TO authenticated;

-- ROLLBACK: create a follow-up migration with:
-- DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
-- DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
-- DROP POLICY IF EXISTS "Users can insert own landlord profile" ON public.profiles;
-- CREATE POLICY "Users can manage own profile"
--   ON public.profiles FOR ALL
--   USING (id = auth.uid())
--   WITH CHECK (id = auth.uid());
-- GRANT UPDATE ON public.profiles TO anon, authenticated;
-- and CREATE OR REPLACE public.handle_new_user() with the body from
-- 20260420000000_add_profiles_role.sql (role from metadata, default landlord).
