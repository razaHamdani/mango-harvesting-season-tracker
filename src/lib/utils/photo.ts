import { SupabaseClient } from '@supabase/supabase-js'

const BUCKET = 'aam-daata-photos'

/**
 * Generate a signed URL for a stored photo.
 * Photos are uploaded directly from the browser (see
 * components/photo/photo-upload.tsx); this helper is used server-side to
 * produce short-lived signed URLs for display.
 *
 * @param supabase - Supabase client instance
 * @param path - Storage path
 * @param expiresIn - URL expiry in seconds (default 3600 = 1hr)
 * @returns Signed URL string or null
 */
export async function getPhotoUrl(
  supabase: SupabaseClient,
  path: string,
  expiresIn = 3600
): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, expiresIn)

  if (error) {
    console.error('Failed to get photo URL:', error.message)
    return null
  }

  return data.signedUrl
}
