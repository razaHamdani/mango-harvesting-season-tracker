import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { Database } from '@/types/database'
import { authLimiter, enforceLimit } from '@/lib/utils/rate-limiter'
import { getClientIp } from '@/lib/utils/client-ip'

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

  let supabaseResponse = NextResponse.next({ request })

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
          supabaseResponse = NextResponse.next({ request })
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

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
