/**
 * 7C — resendConfirmation rate-limit path.
 *
 * When the auth limit is exhausted, resendConfirmation must:
 *   1. Return { ok: true } (constant response — never reveal rate-limit status)
 *   2. NOT call supabase.auth.resend (no mailer cost, no DB hit)
 *
 * Mirrors the pattern in auth.test.ts.
 */
import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/utils/client-ip', () => ({
  getClientIpFromHeaders: async () => '127.0.0.1',
  getClientIp: () => '127.0.0.1',
}))

vi.mock('@/lib/utils/rate-limiter', () => ({
  authLimiter: {},
  mutationLimiter: null,
  enforceLimit: vi.fn().mockResolvedValue({ allowed: false }),
}))

const resendMock = vi.fn()
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { resend: resendMock },
  }),
}))

import { resendConfirmation } from '@/lib/actions/auth-actions'

describe('resendConfirmation — rate-limit path', () => {
  it('returns { ok: true } and does NOT call supabase.auth.resend when limited', async () => {
    const result = await resendConfirmation('victim@example.com')
    expect(result).toEqual({ ok: true })
    expect(resendMock).not.toHaveBeenCalled()
  })
})
