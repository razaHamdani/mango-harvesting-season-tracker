-- ============================================================
-- Phase 5A.2 — Lock down aam-daata-photos bucket
--
-- The bucket was created without `file_size_limit` or
-- `allowed_mime_types`. Authenticated users could upload
-- 50MB-per-file binaries (PDFs, executables) — a denial-of-wallet
-- vector for storage cost.
--
-- Enforce server-side at the bucket layer:
--   * 10 MiB per file
--   * Only image/jpeg, image/png, image/webp
-- ============================================================

UPDATE storage.buckets
SET
  file_size_limit = 10485760,                                      -- 10 MiB
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp']
WHERE id = 'aam-daata-photos';
