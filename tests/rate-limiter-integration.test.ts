import { afterEach, describe, expect, it, vi } from 'vitest'

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

describe('production startup guard', () => {
  afterEach(() => {
    vi.resetModules()
  })

  it('throws when NODE_ENV=production and env vars missing', async () => {
    const originalEnv = process.env.NODE_ENV
    const originalUrl = process.env.UPSTASH_REDIS_REST_URL
    const originalToken = process.env.UPSTASH_REDIS_REST_TOKEN

    // @ts-expect-error: NODE_ENV is readonly in types but writable at runtime
    process.env.NODE_ENV = 'production'
    delete process.env.UPSTASH_REDIS_REST_URL
    delete process.env.UPSTASH_REDIS_REST_TOKEN

    try {
      // Re-import the module fresh so createLimiters() re-runs
      vi.resetModules()
      await expect(import('@/lib/utils/rate-limiter')).rejects.toThrow(
        /UPSTASH_REDIS_REST_URL.*required in production/
      )
    } finally {
      // @ts-expect-error
      process.env.NODE_ENV = originalEnv
      if (originalUrl !== undefined) process.env.UPSTASH_REDIS_REST_URL = originalUrl
      if (originalToken !== undefined) process.env.UPSTASH_REDIS_REST_TOKEN = originalToken
    }
  })
})
