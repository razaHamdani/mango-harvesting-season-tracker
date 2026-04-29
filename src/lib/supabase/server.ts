import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { Database } from '@/types/database'
import { attachRequestContext } from '@/lib/utils/request-context'

export async function createClient() {
  // Attach the requestId Sentry tag once per request. Every Server Action and
  // Server Component goes through this entry point; this avoids touching all
  // 22 actions individually.
  await attachRequestContext()

  const cookieStore = await cookies()

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            )
          } catch {
            // The `setAll` method is called from a Server Component where
            // cookies cannot be set. This is safe to ignore if you have
            // middleware (proxy) refreshing user sessions.
          }
        },
      },
    },
  )
}
