/**
 * 5D.1 — signInUser rate limiting
 *
 * Overrides the global rate-limiter mock from setup.ts to simulate an
 * exhausted auth rate limit. Verifies signInUser returns the correct
 * "Too many requests" error without reaching Supabase.
 */
import { describe, expect, it, vi } from 'vitest'

// Mock client-ip before any server action import so `next/headers` is
// never dynamically imported in the test environment.
vi.mock('@/lib/utils/client-ip', () => ({
  getClientIpFromHeaders: async () => '127.0.0.1',
}))

// Override the global "always allow" rate-limiter stub from setup.ts.
// Here we simulate an exhausted auth limit so enforceLimit blocks.
vi.mock('@/lib/utils/rate-limiter', () => ({
  authLimiter: {},   // non-null so enforceLimit is called
  mutationLimiter: null,
  enforceLimit: vi.fn().mockResolvedValue({ allowed: false }),
}))

// Keep EMAIL_RE real; spy on the DNS lookup so we can assert it is never
// reached when the rate limit blocks first. vi.hoisted because the vi.mock
// factory below is hoisted above this declaration.
const { hasMxRecordsMock } = vi.hoisted(() => ({
  hasMxRecordsMock: vi.fn(async () => true),
}))
vi.mock('@/lib/utils/email-validation', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/utils/email-validation')>()
  return { ...actual, hasMxRecords: hasMxRecordsMock }
})

import { signInUser, signUpUser } from '@/lib/actions/auth-actions'

describe('signInUser — rate limiting (5D.1)', () => {
  it('returns "Too many requests" error when rate limit is exhausted', async () => {
    const fd = new FormData()
    fd.set('email', 'victim@example.com')
    fd.set('password', 'somepassword')

    const result = await signInUser(fd)

    expect(result).toEqual({ error: 'Too many requests. Try again later.' })
  })
})

describe('signUpUser — rate limit precedes DNS work (R2)', () => {
  it('blocks before the MX lookup, so DNS is never resolved', async () => {
    const fd = new FormData()
    fd.set('role', 'landlord')
    fd.set('email', 'someone@example.com')
    fd.set('password', 'somepassword1A')
    fd.set('full_name', 'Someone')

    const result = await signUpUser(fd)

    expect(result).toEqual({ error: 'Too many requests. Try again later.' })
    expect(hasMxRecordsMock).not.toHaveBeenCalled()
  })
})
