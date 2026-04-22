/**
 * Client IP extraction — Phase 2
 *
 * Extracts the real client IP from request headers.
 *
 * Strategy: prefer x-real-ip (set by Vercel/Cloudflare to the actual client).
 * For X-Forwarded-For, take the RIGHTMOST entry — the left-most can be spoofed
 * by the client, while the rightmost is appended by the trusted platform proxy.
 *
 * Falls back to 'unknown' when no usable header is present.
 */

import type { NextRequest } from 'next/server'

/**
 * Extract client IP from a Next.js middleware request.
 * Use this in proxy.ts / middleware.
 */
export function getClientIp(request: NextRequest): string {
  const realIp = request.headers.get('x-real-ip')
  if (realIp?.trim()) return realIp.trim()

  const xff = request.headers.get('x-forwarded-for')
  if (xff) {
    const entries = xff.split(',').map((s) => s.trim()).filter(Boolean)
    const rightmost = entries[entries.length - 1]
    if (rightmost) return rightmost
  }

  return 'unknown'
}

/**
 * Extract client IP inside a Server Action or Route Handler.
 * Dynamically imports `next/headers` so this module stays importable
 * in non-Next.js contexts (e.g. Vitest).
 */
export async function getClientIpFromHeaders(): Promise<string> {
  const { headers } = await import('next/headers')
  const h = await headers()

  const realIp = h.get('x-real-ip')
  if (realIp?.trim()) return realIp.trim()

  const xff = h.get('x-forwarded-for')
  if (xff) {
    const entries = xff.split(',').map((s) => s.trim()).filter(Boolean)
    const rightmost = entries[entries.length - 1]
    if (rightmost) return rightmost
  }

  return 'unknown'
}
