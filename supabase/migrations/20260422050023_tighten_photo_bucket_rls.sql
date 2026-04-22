-- ============================================================
-- Phase 1.5 — Tighten photo bucket RLS (second path segment)
--
-- The original policies check only that the first path segment
-- (userId) matches the caller:
--   (storage.foldername(name))[1] = auth.uid()::text
--
-- This allows a user to upload to:
--   their-uid/SOMEONE-ELSES-SEASON-ID/expenses/...
--
-- because only the first segment is validated. The server-side
-- path validator (Phase 1.4) guards what gets *recorded* in the
-- DB, but the direct Supabase storage upload bypasses it.
--
-- Fix: additionally require the second segment (seasonId) to
-- belong to a season owned by the caller. We DROP and recreate
-- the three policies so the condition is consistent.
-- ============================================================

-- Drop the existing single-segment policies
DROP POLICY IF EXISTS "Users can upload own photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can read own photos"   ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own photos" ON storage.objects;

-- INSERT: first segment = uid, second segment = owned season
CREATE POLICY "Users can upload own photos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
    bucket_id = 'aam-daata-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
    AND (storage.foldername(name))[2] IN (
        SELECT id::text FROM public.seasons
        WHERE owner_id = auth.uid()
    )
);

-- SELECT: same two-segment check
CREATE POLICY "Users can read own photos"
ON storage.objects FOR SELECT TO authenticated
USING (
    bucket_id = 'aam-daata-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
    AND (storage.foldername(name))[2] IN (
        SELECT id::text FROM public.seasons
        WHERE owner_id = auth.uid()
    )
);

-- DELETE: same two-segment check
CREATE POLICY "Users can delete own photos"
ON storage.objects FOR DELETE TO authenticated
USING (
    bucket_id = 'aam-daata-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
    AND (storage.foldername(name))[2] IN (
        SELECT id::text FROM public.seasons
        WHERE owner_id = auth.uid()
    )
);
