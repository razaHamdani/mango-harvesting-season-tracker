import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { Database } from '@/types/database'

/**
 * Auth callback handler — exchanges the token_hash from Supabase's email
 * confirmation link for a real session, then redirects to the app.
 *
 * Supabase sends confirmation links of the form:
 *   /auth/callback?token_hash=<hash>&type=signup&next=/dashboard
 *
 * This route must be reachable without authentication (whitelisted in proxy.ts).
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type') as 'signup' | 'recovery' | 'invite' | 'email' | null
  const next = searchParams.get('next') ?? '/dashboard'

  if (token_hash && type) {
    const cookieStore = await cookies()

    const supabase = createServerClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            )
          },
        },
      },
    )

    const { error } = await supabase.auth.verifyOtp({ token_hash, type })

    if (!error) {
      // Session is now set in cookies — redirect into the app.
      return NextResponse.redirect(`${origin}${next}`)
    }

    console.error('[auth/callback] verifyOtp failed', error.message)
  }

  // Expired or invalid link — send back to login with a visible error.
  return NextResponse.redirect(`${origin}/login?error=confirmation-failed`)
}
