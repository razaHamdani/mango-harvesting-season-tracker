'use client'

import {
  Dialog,
  DialogContent,
  DialogTrigger,
} from '@/components/ui/dialog'

interface PhotoThumbnailLightboxProps {
  url: string
  alt: string
}

export function PhotoThumbnailLightbox({ url, alt }: PhotoThumbnailLightboxProps) {
  return (
    <Dialog>
      <DialogTrigger>
        <img
          src={url}
          alt={alt}
          className="h-20 w-20 cursor-pointer rounded-md object-cover transition-opacity hover:opacity-80"
        />
      </DialogTrigger>
      <DialogContent showCloseButton className="max-w-lg sm:max-w-lg p-2">
        <img
          src={url}
          alt={alt}
          className="w-full rounded-md object-contain"
        />
      </DialogContent>
    </Dialog>
  )
}
