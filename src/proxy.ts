import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { Database } from '@/types/database'
import { checkRateLimit } from '@/lib/utils/rate-limiter'

// 10 login/signup attempts per 5-minute window per IP
const LOGIN_LIMIT = 10
const LOGIN_WINDOW_MS = 5 * 60 * 1000

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const { method } = request

  if (pathname === '/login' && method === 'POST') {
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
      'unknown'
    const { allowed } = checkRateLimit(`login:${ip}`, LOGIN_LIMIT, LOGIN_WINDOW_MS)
    if (!allowed) {
      return new NextResponse('Too many requests. Please try again later.', {
        status: 429,
        headers: { 'Retry-After': '300' },
      })
    }
  }
  let supabaseResponse = NextResponse.next({
    request,
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
          supabaseResponse = NextResponse.next({
            request,
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

  // Unauthenticated users get redirected to /login (except if already on /login)
  if (!user && pathname !== '/login') {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Authenticated users on /login get redirected to /dashboard
  if (user && pathname === '/login') {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder assets (images, svgs, etc.)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
