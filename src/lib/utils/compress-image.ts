import imageCompression from 'browser-image-compression'

/**
 * Map a file's MIME type to a storage filename extension.
 * Used by photo-upload.tsx to choose the extension for the random filename
 * after compressForUpload may have converted the input format (e.g. PNG→JPEG).
 *
 * Fallback is 'jpg' (universal default for camera output and what
 * compressForUpload produces). Do NOT fall back to the input filename's
 * extension — that's the bug 7B fixed.
 */
const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

export function extensionForMime(mime: string): string {
  return MIME_TO_EXT[mime] ?? 'jpg'
}

export async function compressForUpload(file: File): Promise<File> {
  if (!file.type.startsWith('image/')) return file
  if (file.size <= 500_000) return file
  return imageCompression(file, {
    maxSizeMB: 1,
    maxWidthOrHeight: 1920,
    useWebWorker: true,
    fileType: 'image/jpeg',
    initialQuality: 0.85,
    preserveExif: true,
  })
}
