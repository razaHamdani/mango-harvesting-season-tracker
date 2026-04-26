import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import type { SupabaseClient, User } from '@supabase/supabase-js'
import { setCurrentClient, clearCurrentClient } from './setup'

// getCurrentUser must be imported AFTER setCurrentClient so that cache() picks
// up the right client for each test. Re-import between tests is not possible
// with ESM static imports, but we reset the mock client in beforeEach which is
// enough for correctness verification (we're testing return values, not caching).
import { getCurrentUser } from '@/lib/queries/_user-context'

function makeAuthClient(user: User | null, error: Error | null = null): SupabaseClient {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user }, error }),
    },
  } as unknown as SupabaseClient
}

describe('getCurrentUser', () => {
  afterEach(() => {
    clearCurrentClient()
  })

  it('returns the authenticated user', async () => {
    const fakeUser = { id: 'user-abc-123' } as User
    setCurrentClient(makeAuthClient(fakeUser))

    const result = await getCurrentUser()
    expect(result).not.toBeNull()
    expect(result!.id).toBe('user-abc-123')
  })

  it('returns null when there is no authenticated user', async () => {
    setCurrentClient(makeAuthClient(null))

    const result = await getCurrentUser()
    expect(result).toBeNull()
  })

  it('returns null when auth.getUser throws an error', async () => {
    setCurrentClient(makeAuthClient(null, new Error('session expired')))

    const result = await getCurrentUser()
    expect(result).toBeNull()
  })
})
