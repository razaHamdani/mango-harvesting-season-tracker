'use client'

import { useRef, useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { XIcon, CameraIcon, Loader2Icon, AlertCircleIcon } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { compressForUpload, extensionForMime } from '@/lib/utils/compress-image'

const BUCKET = 'aam-daata-photos'

interface PhotoUploadProps {
  /**
   * Storage path prefix, e.g. "{userId}/{seasonId}/activities".
   * The component appends a random filename and uploads directly from
   * the browser. On success it calls onChange with the full storage path.
   */
  pathPrefix: string
  name: string
  onChange?: (photoPath: string | null) => void
}

type UploadState =
  | { kind: 'idle' }
  | { kind: 'compressing' }
  | { kind: 'uploading' }
  | { kind: 'uploaded'; path: string }
  | { kind: 'error'; message: string; file: File }

export function PhotoUpload({ pathPrefix, name, onChange }: PhotoUploadProps) {
  const [preview, setPreview] = useState<string | null>(null)
  const [state, setState] = useState<UploadState>({ kind: 'idle' })
  const inputRef = useRef<HTMLInputElement>(null)

  const startUpload = useCallback(
    async (file: File) => {
      setState({ kind: 'compressing' })

      let uploadFile: File
      try {
        uploadFile = await compressForUpload(file)
      } catch {
        setState({ kind: 'error', message: 'Compression failed', file })
        onChange?.(null)
        return
      }

      setState({ kind: 'uploading' })

      // Derive extension from the actual output MIME, not the input filename.
      // See extensionForMime() for rationale.
      const ext = extensionForMime(uploadFile.type)

      const uuid =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}`
      const path = `${pathPrefix}/${uuid}.${ext}`

      const supabase = createClient()
      const { error } = await supabase.storage.from(BUCKET).upload(path, uploadFile, {
        cacheControl: '3600',
        upsert: false,
        contentType: uploadFile.type,
      })

      if (error) {
        setState({ kind: 'error', message: error.message, file })
        onChange?.(null)
        return
      }

      setState({ kind: 'uploaded', path })
      onChange?.(path)
    },
    [pathPrefix, onChange]
  )

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0] ?? null

      setPreview((prev) => {
        if (prev) URL.revokeObjectURL(prev)
        return file ? URL.createObjectURL(file) : null
      })

      if (!file) {
        setState({ kind: 'idle' })
        onChange?.(null)
        return
      }

      void startUpload(file)
    },
    [onChange, startUpload]
  )

  const handleRemove = useCallback(() => {
    setPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return null
    })
    if (inputRef.current) inputRef.current.value = ''
    setState({ kind: 'idle' })
    onChange?.(null)
  }, [onChange])

  const handleRetry = useCallback(() => {
    if (state.kind === 'error') void startUpload(state.file)
  }, [state, startUpload])

  const isBusy = state.kind === 'compressing' || state.kind === 'uploading'

  return (
    <div className="flex items-start gap-3">
      {preview ? (
        <div className="relative">
          <img
            src={preview}
            alt="Selected photo preview"
            className="h-20 w-20 rounded-md object-cover"
          />
          {isBusy && (
            <div className="absolute inset-0 flex items-center justify-center rounded-md bg-black/40">
              <Loader2Icon className="h-5 w-5 animate-spin text-white" />
            </div>
          )}
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="absolute -top-2 -right-2 h-5 w-5 rounded-full bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90"
            onClick={handleRemove}
            disabled={isBusy}
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

      <div className="flex flex-col gap-1 text-xs">
        {state.kind === 'compressing' && (
          <span className="text-muted-foreground">Compressing image…</span>
        )}
        {state.kind === 'uploading' && (
          <span className="text-muted-foreground">Uploading…</span>
        )}
        {state.kind === 'uploaded' && (
          <span className="text-muted-foreground">Uploaded</span>
        )}
        {state.kind === 'error' && (
          <>
            <span className="flex items-center gap-1 text-destructive">
              <AlertCircleIcon className="h-3 w-3" />
              Upload failed: {state.message}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleRetry}
            >
              Retry
            </Button>
          </>
        )}
      </div>

      <input
        ref={inputRef}
        id={`photo-upload-${name}`}
        name={`${name}_file`}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        onChange={handleFileChange}
        disabled={isBusy}
      />
    </div>
  )
}
