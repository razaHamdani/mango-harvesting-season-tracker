'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { PhotoThumbnailLightbox } from './photo-thumbnail-lightbox'

const BUCKET = 'aam-daata-photos'
const TTL_SECONDS = 300

export function PhotoThumbnailClient({ path, alt }: { path: string; alt?: string }) {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const supabase = createClient()
    supabase.storage
      .from(BUCKET)
      .createSignedUrl(path, TTL_SECONDS)
      .then(({ data }) => {
        if (!cancelled && data?.signedUrl) setUrl(data.signedUrl)
      })
    return () => {
      cancelled = true
    }
  }, [path])

  if (!url) return null
  return <PhotoThumbnailLightbox url={url} alt={alt ?? 'Photo'} />
}
