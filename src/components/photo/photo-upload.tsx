'use client'

import { useRef, useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { XIcon, CameraIcon } from 'lucide-react'

interface PhotoUploadProps {
  name: string
  onChange?: (file: File | null) => void
}

export function PhotoUpload({ name, onChange }: PhotoUploadProps) {
  const [preview, setPreview] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0] ?? null

      if (file) {
        const url = URL.createObjectURL(file)
        setPreview((prev) => {
          if (prev) URL.revokeObjectURL(prev)
          return url
        })
      } else {
        setPreview((prev) => {
          if (prev) URL.revokeObjectURL(prev)
          return null
        })
      }

      onChange?.(file)
    },
    [onChange]
  )

  const handleRemove = useCallback(() => {
    setPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return null
    })

    if (inputRef.current) {
      inputRef.current.value = ''
    }

    onChange?.(null)
  }, [onChange])

  return (
    <div className="flex items-center gap-3">
      {preview ? (
        <div className="relative">
          <img
            src={preview}
            alt="Selected photo preview"
            className="h-20 w-20 rounded-md object-cover"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="absolute -top-2 -right-2 h-5 w-5 rounded-full bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90"
            onClick={handleRemove}
          >
            <XIcon className="h-3 w-3" />
            <span className="sr-only">Remove photo</span>
          </Button>
        </div>
      ) : (
        <label
          htmlFor={`photo-upload-${name}`}
          className="flex h-20 w-20 cursor-pointer items-center justify-center rounded-md border-2 border-dashed border-muted-foreground/25 text-muted-foreground transition-colors hover:border-muted-foreground/50 hover:text-foreground"
        >
          <CameraIcon className="h-6 w-6" />
          <span className="sr-only">Select photo</span>
        </label>
      )}

      <input
        ref={inputRef}
        id={`photo-upload-${name}`}
        name={name}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        onChange={handleFileChange}
      />
    </div>
  )
}
