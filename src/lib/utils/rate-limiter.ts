/**
 * Rate limiter — Phase 2
 *
 * Uses Upstash Redis + @upstash/ratelimit (sliding window).
 *
 * Limiters are null when UPSTASH_REDIS_REST_URL/TOKEN are absent,
 * and enforceLimit treats null as "not configured — allow everything".
 * This lets the app run during local dev before Upstash is wired up.
 *
 * Fail policies (decided):
 *   authLimiter     → fail-closed (false)  – auth endpoints never skip on outage
 *   mutationLimiter → fail-open  (true)    – harvest-day availability > abuse window
 *
 * No readLimiter: reads are protected by auth + RLS + RPC guard.
 * A read limiter would burn Upstash free-tier budget on every insights page load.
 *
 * No uploadLimiter: photos upload directly from the browser to Supabase Storage,
 * which enforces per-user MIME + size limits at the bucket level. Rate-limiting
 * after the upload is theatre.
 */

import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

export type { Ratelimit }

function createLimiters(): {
  auth: Ratelimit
  mutation: Ratelimit
} | null {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN

  if (!url || !token) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        '[rate-limit] UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are required in production. ' +
        'Rate limiting is disabled — refusing to start.'
      )
    }
    if (process.env.NODE_ENV !== 'test') {
      console.warn(
        '[rate-limit] UPSTASH_REDIS_REST_URL/TOKEN not set — ' +
          'rate limiting is DISABLED. Set these env vars before deploying.'
      )
    }
    return null
  }

  const redis = new Redis({ url, token })

  return {
    auth: new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(10, '5 m'),
      prefix: 'rl:auth',
    }),
    mutation: new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(60, '1 m'),
      prefix: 'rl:mut',
    }),
  }
}

const _limiters = createLimiters()

/** 10 requests per 5 minutes per IP. fail-closed on Redis outage. */
export const authLimiter: Ratelimit | null = _limiters?.auth ?? null

/** 60 mutations per minute per user. fail-open on Redis outage (harvest-day safety). */
export const mutationLimiter: Ratelimit | null = _limiters?.mutation ?? null

/**
 * Apply a rate limit.
 *
 * @param limiter  - Ratelimit instance, or null (not configured → always allow)
 * @param key      - e.g. 'ip:1.2.3.4' or 'user:abc-123'
 * @param failOpen - true = allow on Redis outage; false (default) = block on outage
 */
export async function enforceLimit(
  limiter: Ratelimit | null,
  key: string,
  failOpen = false
): Promise<{ allowed: boolean }> {
  if (!limiter) return { allowed: true }

  try {
    const result = await limiter.limit(key)
    return { allowed: result.success }
  } catch (err) {
    console.error('[rate-limit] redis unreachable', err)
    return { allowed: failOpen }
  }
}
