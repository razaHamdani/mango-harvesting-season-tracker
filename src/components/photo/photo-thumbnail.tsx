import { createClient } from '@/lib/supabase/server'
import { getPhotoUrl } from '@/lib/utils/photo'
import { PhotoThumbnailLightbox } from './photo-thumbnail-lightbox'

interface PhotoThumbnailProps {
  path: string | null | undefined
  alt?: string
}

export async function PhotoThumbnail({ path, alt = 'Photo' }: PhotoThumbnailProps) {
  if (!path) return null

  const supabase = await createClient()
  const url = await getPhotoUrl(supabase, path)

  if (!url) return null

  return <PhotoThumbnailLightbox url={url} alt={alt} />
}
