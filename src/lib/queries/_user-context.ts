import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import type { User } from '@supabase/supabase-js'

/**
 * Returns the currently authenticated user, or null if there is no session.
 *
 * Wrapped in React's `cache()` so that within a single Server Component render
 * tree, `auth.getUser()` is called exactly once regardless of how many query
 * functions invoke this helper. Each new request gets a fresh cache scope.
 *
 * Note: in Server Actions (each action is its own request) this provides no
 * deduplication benefit, but it's still safe to call — the cache scope is
 * request-scoped, never shared across users.
 */
export const getCurrentUser = cache(async (): Promise<User | null> => {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()
  if (error || !user) return null
  return user
})
