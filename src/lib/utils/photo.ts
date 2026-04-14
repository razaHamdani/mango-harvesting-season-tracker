import { SupabaseClient } from '@supabase/supabase-js'

const BUCKET = 'aam-daata-photos'

/**
 * Upload a photo to Supabase Storage.
 * Called WITHIN server actions (not standalone).
 * @param supabase - Supabase client instance
 * @param file - File to upload
 * @param path - Storage path e.g. "{userId}/{seasonId}/activities/{activityId}.jpg"
 * @returns The storage path on success, null on failure
 */
export async function uploadPhotoToStorage(
  supabase: SupabaseClient,
  file: File,
  path: string
): Promise<string | null> {
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, {
      cacheControl: '3600',
      upsert: true,
    })

  if (error) {
    console.error('Photo upload failed:', error.message)
    return null
  }

  return path
}

/**
 * Generate a signed URL for a stored photo.
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
