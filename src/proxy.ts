import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { Database } from '@/types/database'
import { authLimiter, enforceLimit } from '@/lib/utils/rate-limiter'
import { getClientIp } from '@/lib/utils/client-ip'

function buildCsp(nonce: string): string {
  const isDev = process.env.NODE_ENV === 'development'
  const cspHeader = `
    default-src 'self';
    script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ''};
    connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.upstash.io;
    img-src 'self' data: blob: https://*.supabase.co;
    style-src 'self' 'unsafe-inline';
    font-src 'self' data:;
    frame-ancestors 'none';
  `
  return cspHeader.replace(/\s{2,}/g, ' ').trim()
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const { method } = request

  // Rate limit: auth endpoint (fail-closed — authLimiter default)
  if (pathname === '/login' && method === 'POST') {
    const ip = getClientIp(request)
    const { allowed } = await enforceLimit(authLimiter, `ip:${ip}`)
    if (!allowed) {
      return new NextResponse('Too many requests. Please try again later.', {
        status: 429,
        headers: { 'Retry-After': '300' },
      })
    }
  }

  // Generate a fresh nonce for this request and forward it to the page.
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64')
  const csp = buildCsp(nonce)

  // Short request ID for log correlation across proxy + Server Actions + Sentry.
  // NOT set via Sentry.setTag here — that mutates the global hub and would bleed
  // across concurrent requests. Instead, beforeSend in sentry.server.config.ts reads
  // the x-request-id header that we attach below.
  const requestId = crypto.randomUUID().slice(0, 8)

  // Attach nonce + request ID to the request headers so Server Components and
  // Server Actions can read them via next/headers.
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-nonce', nonce)
  requestHeaders.set('x-request-id', requestId)
  requestHeaders.set('Content-Security-Policy', csp)

  // Pass the modified request headers into NextResponse.next so Next.js
  // picks up x-nonce during SSR.
  let supabaseResponse = NextResponse.next({
    request: { headers: requestHeaders },
  })

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          )
          // Recreate the response preserving the modified request headers.
          supabaseResponse = NextResponse.next({
            request: { headers: requestHeaders },
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  // Refresh the session — important for token refresh
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Unauthenticated users → /login
  if (!user && pathname !== '/login') {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Authenticated users on /login → /dashboard
  if (user && pathname === '/login') {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  // Set CSP, request ID, and other security headers on the response.
  supabaseResponse.headers.set('Content-Security-Policy', csp)
  supabaseResponse.headers.set('x-request-id', requestId)
  supabaseResponse.headers.set('X-Frame-Options', 'DENY')
  supabaseResponse.headers.set('X-Content-Type-Options', 'nosniff')
  supabaseResponse.headers.set(
    'Referrer-Policy',
    'strict-origin-when-cross-origin',
  )
  supabaseResponse.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=()',
  )

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
