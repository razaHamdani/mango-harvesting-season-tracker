'use client'

import { useRef, useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { CameraIcon, Loader2Icon, AlertCircleIcon } from 'lucide-react'
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

  function renderState() {
    if (preview) {
      return (
        <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', border: '1px solid var(--border)', display: 'inline-block' }}>
          <img
            src={preview}
            alt="Selected photo preview"
            style={{ width: '100%', height: 180, objectFit: 'cover', display: 'block' }}
          />
          {/* hover overlay */}
          <div
            style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, oklch(0 0 0 / 50%) 0%, transparent 50%)', opacity: 0, transition: 'opacity 120ms' }}
            onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
            onMouseLeave={e => (e.currentTarget.style.opacity = '0')}
          >
            <div style={{ position: 'absolute', bottom: 12, right: 12, display: 'flex', gap: 8 }}>
              <label htmlFor={`photo-upload-${name}`} style={{ cursor: 'pointer' }}>
                <Button type="button" variant="ghost" size="sm" style={{ background: 'var(--surface)', pointerEvents: 'none' }} tabIndex={-1}>
                  Replace
                </Button>
              </label>
              <Button type="button" variant="ghost" size="sm" style={{ background: 'var(--surface)' }} onClick={handleRemove} disabled={isBusy}>
                Remove
              </Button>
            </div>
          </div>
          {isBusy && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'oklch(0 0 0 / 40%)' }}>
              <Loader2Icon className="h-5 w-5 animate-spin" style={{ color: 'white' }} />
            </div>
          )}
        </div>
      )
    }

    switch (state.kind) {
      case 'idle':
        return (
          <label
            htmlFor={`photo-upload-${name}`}
            className="dropzone"
            style={{ cursor: 'pointer' }}
          >
            <div style={{
              width: 40, height: 40, borderRadius: 999,
              background: 'var(--clay-soft)',
              display: 'grid', placeItems: 'center',
              color: 'var(--bark)',
            }}>
              <CameraIcon className="h-[18px] w-[18px]" />
            </div>
            <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--heading)' }}>Add photo</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Tap to take a picture or choose a file</div>
          </label>
        )
      case 'compressing':
        return (
          <div className="dropzone" style={{ opacity: 0.7 }}>
            <div style={{
              width: 24, height: 24,
              border: '2px solid var(--border)',
              borderTopColor: 'var(--mango)',
              borderRadius: 999,
              animation: 'spin 0.7s linear infinite',
            }} />
            <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>Compressing…</div>
          </div>
        )
      case 'uploading':
        return (
          <div className="dropzone">
            <CameraIcon className="h-6 w-6 muted" style={{ color: 'var(--text-muted)' }} />
            <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>Uploading…</div>
            {/* thin progress bar — indeterminate shimmer */}
            <div style={{ width: 200, height: 4, background: 'var(--border)', borderRadius: 999, overflow: 'hidden', marginTop: 6 }}>
              <div style={{ height: '100%', width: '60%', background: 'var(--mango)', borderRadius: 999 }} />
            </div>
          </div>
        )
      case 'uploaded':
        // preview handles the uploaded state above
        return null
      case 'error':
        return (
          <div className="dropzone" style={{ borderColor: 'var(--rust)' }}>
            <div style={{
              width: 40, height: 40, borderRadius: 999,
              background: 'var(--rust-soft)',
              display: 'grid', placeItems: 'center',
              color: 'var(--rust)',
            }}>
              <AlertCircleIcon className="h-[18px] w-[18px]" />
            </div>
            <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--rust)' }}>Upload failed</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', maxWidth: 240, textAlign: 'center' }}>{state.message}</div>
            <Button type="button" variant="ghost" size="sm" onClick={handleRetry}>Retry</Button>
          </div>
        )
    }
  }

  return (
    <div>
      {renderState()}
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
