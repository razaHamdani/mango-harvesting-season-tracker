import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock browser-image-compression before importing the util under test.
// Canvas and Web Workers are not available in Vitest's node environment.
vi.mock('browser-image-compression', () => ({
  default: vi.fn(),
}))

import imageCompression from 'browser-image-compression'
import { compressForUpload, extensionForMime } from '@/lib/utils/compress-image'

const mockCompress = vi.mocked(imageCompression)

function makeFile(name: string, type: string, sizeBytes: number): File {
  const content = new Uint8Array(sizeBytes)
  return new File([content], name, { type })
}

beforeEach(() => {
  mockCompress.mockClear()
})

describe('compressForUpload', () => {
  it('returns non-image files unchanged', async () => {
    const pdf = makeFile('receipt.pdf', 'application/pdf', 2_000_000)
    const result = await compressForUpload(pdf)
    expect(result).toBe(pdf)
    expect(mockCompress).not.toHaveBeenCalled()
  })

  it('returns small images (≤500KB) unchanged', async () => {
    const small = makeFile('thumb.jpg', 'image/jpeg', 400_000)
    const result = await compressForUpload(small)
    expect(result).toBe(small)
    expect(mockCompress).not.toHaveBeenCalled()
  })

  it('calls imageCompression with correct options for large images', async () => {
    const compressed = makeFile('compressed.jpg', 'image/jpeg', 900_000)
    mockCompress.mockResolvedValueOnce(compressed)

    const large = makeFile('phone.jpg', 'image/jpeg', 12_000_000)
    const result = await compressForUpload(large)

    expect(mockCompress).toHaveBeenCalledOnce()
    expect(mockCompress).toHaveBeenCalledWith(large, {
      maxSizeMB: 1,
      maxWidthOrHeight: 1920,
      useWebWorker: true,
      fileType: 'image/jpeg',
      initialQuality: 0.85,
      preserveExif: true,
    })
    expect(result).toBe(compressed)
  })

  it('extensionForMime returns correct extension for known types', () => {
    expect(extensionForMime('image/jpeg')).toBe('jpg')
    expect(extensionForMime('image/png')).toBe('png')
    expect(extensionForMime('image/webp')).toBe('webp')
  })

  it('extensionForMime falls back to jpg for empty or unknown types', () => {
    // Some camera apps strip the MIME type. The fallback must NOT use the input
    // filename extension (that's the bug 7B fixed). Default to jpg since
    // compressForUpload always produces JPEG for compressed output.
    expect(extensionForMime('')).toBe('jpg')
    expect(extensionForMime('application/octet-stream')).toBe('jpg')
    expect(extensionForMime('image/bmp')).toBe('jpg')
  })

  it('returns compressed result for PNG large images (output is JPEG)', async () => {
    // compressForUpload converts to JPEG regardless of input format.
    // The returned file carries image/jpeg MIME — photo-upload.tsx uses this to
    // derive the correct .jpg extension rather than the original .png filename.
    const compressed = makeFile('out.jpg', 'image/jpeg', 800_000)
    mockCompress.mockResolvedValueOnce(compressed)

    const large = makeFile('scan.png', 'image/png', 5_000_000)
    const result = await compressForUpload(large)

    expect(mockCompress).toHaveBeenCalledOnce()
    expect(result).toBe(compressed)
    // The output file's type is image/jpeg — callers must use this, not the input filename.
    expect(result.type).toBe('image/jpeg')
  })
})
