import { describe, expect, it, vi } from 'vitest'

// Undo the global mock from setup.ts so we test the real enforceLimit logic.
vi.unmock('@/lib/utils/rate-limiter')

import { enforceLimit } from '@/lib/utils/rate-limiter'
import type { Ratelimit } from '@upstash/ratelimit'

/**
 * Phase 2 — enforceLimit unit tests.
 *
 * These tests inject fake Ratelimit objects so no Redis connection is needed.
 * They verify the fail-open/fail-closed/null-limiter behaviour of enforceLimit.
 */

function makeLimiter(success: boolean): Ratelimit {
  return {
    limit: vi.fn().mockResolvedValue({ success }),
  } as unknown as Ratelimit
}

function makeThrowingLimiter(): Ratelimit {
  return {
    limit: vi.fn().mockRejectedValue(new Error('Redis connection refused')),
  } as unknown as Ratelimit
}

describe('enforceLimit', () => {
  it('allows when limiter returns success=true', async () => {
    const { allowed } = await enforceLimit(makeLimiter(true), 'ip:1.2.3.4')
    expect(allowed).toBe(true)
  })

  it('blocks when limiter returns success=false', async () => {
    const { allowed } = await enforceLimit(makeLimiter(false), 'ip:1.2.3.4')
    expect(allowed).toBe(false)
  })

  it('fails closed (blocks) when Redis throws and failOpen=false', async () => {
    const { allowed } = await enforceLimit(makeThrowingLimiter(), 'ip:1.2.3.4', false)
    expect(allowed).toBe(false)
  })

  it('fails open (allows) when Redis throws and failOpen=true', async () => {
    const { allowed } = await enforceLimit(makeThrowingLimiter(), 'ip:1.2.3.4', true)
    expect(allowed).toBe(true)
  })

  it('always allows when limiter is null (not configured)', async () => {
    const { allowed } = await enforceLimit(null, 'ip:1.2.3.4')
    expect(allowed).toBe(true)
  })

  it('always allows when limiter is null even with failOpen=false', async () => {
    const { allowed } = await enforceLimit(null, 'ip:1.2.3.4', false)
    expect(allowed).toBe(true)
  })
})
