/**
 * Client IP extraction
 *
 * Priority order (first match wins):
 *  1. cf-connecting-ip  — set by Cloudflare; cannot be forged through CF
 *  2. x-real-ip         — set by Vercel / standard reverse proxies
 *  3. x-forwarded-for   — leftmost entry, only trusted when TRUSTED_XFF=leftmost
 *                         is set (requires platform to strip client-supplied XFF)
 *  4. 'unknown'         — falls into a single rate-limit bucket (safe default)
 *
 * Platform notes:
 *  - Vercel only:     headers 2 fires; don't set TRUSTED_XFF
 *  - Cloudflare only: header 1 fires
 *  - Both:            header 1 fires (CF is in front of Vercel)
 *  - Bare metal:      configure reverse proxy to overwrite XFF, then set TRUSTED_XFF=leftmost
 */

import type { NextRequest } from 'next/server'

function extractIp(get: (name: string) => string | null): string {
  // 1. Cloudflare
  const cf = get('cf-connecting-ip')
  if (cf?.trim()) return cf.trim()

  // 2. Vercel / generic platform proxy
  const realIp = get('x-real-ip')
  if (realIp?.trim()) return realIp.trim()

  // 3. XFF leftmost — only when platform attests it strips client-supplied XFF
  if (process.env.TRUSTED_XFF === 'leftmost') {
    const xff = get('x-forwarded-for')
    const leftmost = xff?.split(',')[0]?.trim()
    if (leftmost) return leftmost
  }

  return 'unknown'
}

/**
 * Extract client IP from a Next.js middleware request.
 * Use this in proxy.ts / middleware.
 */
export function getClientIp(request: NextRequest): string {
  return extractIp((name) => request.headers.get(name))
}

/**
 * Extract client IP inside a Server Action or Route Handler.
 * Dynamically imports `next/headers` so this module stays importable
 * in non-Next.js contexts (e.g. Vitest).
 */
export async function getClientIpFromHeaders(): Promise<string> {
  const { headers } = await import('next/headers')
  const h = await headers()
  return extractIp((name) => h.get(name))
}
