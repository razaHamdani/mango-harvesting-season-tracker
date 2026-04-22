import { describe, expect, it } from 'vitest'
import { validatePhotoPath } from '@/lib/utils/validate-photo-path'

const UID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
const SID = 'b2c3d4e5-f6a7-8901-bcde-f12345678901'
const FILE = 'c3d4e5f6-a7b8-9012-cdef-123456789012'

describe('validatePhotoPath', () => {
  it('accepts a valid expenses path', () => {
    const path = `${UID}/${SID}/expenses/${FILE}.jpg`
    expect(validatePhotoPath(path, UID, SID, 'expenses')).toBe(path)
  })

  it('accepts a valid activities path', () => {
    const path = `${UID}/${SID}/activities/${FILE}.webp`
    expect(validatePhotoPath(path, UID, SID, 'activities')).toBe(path)
  })

  it('accepts a valid payments path', () => {
    const path = `${UID}/${SID}/payments/${FILE}.png`
    expect(validatePhotoPath(path, UID, SID, 'payments')).toBe(path)
  })

  it('returns null for null input', () => {
    expect(validatePhotoPath(null, UID, SID, 'expenses')).toBeNull()
  })

  it('returns null for path traversal attempt (../)', () => {
    const path = `${UID}/${SID}/expenses/../../../etc/passwd`
    expect(validatePhotoPath(path, UID, SID, 'expenses')).toBeNull()
  })

  it('returns null when userId segment is wrong', () => {
    const foreignUid = '00000000-0000-0000-0000-000000000000'
    const path = `${foreignUid}/${SID}/expenses/${FILE}.jpg`
    expect(validatePhotoPath(path, UID, SID, 'expenses')).toBeNull()
  })

  it('returns null when seasonId segment is wrong', () => {
    const foreignSid = '00000000-0000-0000-0000-000000000000'
    const path = `${UID}/${foreignSid}/expenses/${FILE}.jpg`
    expect(validatePhotoPath(path, UID, SID, 'expenses')).toBeNull()
  })

  it('returns null when subdir does not match expected', () => {
    // path says activities but caller expects expenses
    const path = `${UID}/${SID}/activities/${FILE}.jpg`
    expect(validatePhotoPath(path, UID, SID, 'expenses')).toBeNull()
  })

  it('returns null for disallowed extension', () => {
    const path = `${UID}/${SID}/expenses/${FILE}.gif`
    expect(validatePhotoPath(path, UID, SID, 'expenses')).toBeNull()
  })

  it('returns null for empty string', () => {
    expect(validatePhotoPath('', UID, SID, 'expenses')).toBeNull()
  })

  it('returns null for path with extra leading slash (double slash attack)', () => {
    const path = `//${UID}/${SID}/expenses/${FILE}.jpg`
    expect(validatePhotoPath(path, UID, SID, 'expenses')).toBeNull()
  })
})
