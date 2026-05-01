-- Phase 9.5: email_exists RPC for explicit duplicate-email signup pre-check.
--
-- Supabase's silent-success-with-empty-identities behavior and its
-- "For security purposes" rate-limit error are both unreliable signals.
-- The user has chosen friendlier UX ("Email already registered") over
-- enumeration resistance. SECURITY DEFINER lets the anon role read
-- auth.users for this single boolean question without exposing the table.

CREATE OR REPLACE FUNCTION public.email_exists(check_email TEXT)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS(SELECT 1 FROM auth.users WHERE LOWER(email) = LOWER(check_email));
$$;

REVOKE ALL ON FUNCTION public.email_exists(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.email_exists(TEXT) TO anon, authenticated;
