import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './env'
import { createAdminClient } from './admin'

export interface TestUser {
  id: string
  email: string
  password: string
  client: SupabaseClient
}

/**
 * Create a throwaway auth user via the admin API (auto-confirmed),
 * then sign in with the anon client so we hold a user-scoped JWT.
 * The `client` we return is authenticated -- every request it makes
 * carries the JWT and is subject to RLS.
 */
export async function createTestUser(label = 'user'): Promise<TestUser> {
  const admin = createAdminClient()
  const suffix = Math.random().toString(36).slice(2, 10)
  const email = `test-${label}-${suffix}@example.com`
  const password = `password-${suffix}`

  const { data: created, error: createError } =
    await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: `Test ${label}` },
    })
  if (createError || !created.user) {
    throw new Error(`createTestUser failed: ${createError?.message}`)
  }

  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { error: signInError } = await client.auth.signInWithPassword({
    email,
    password,
  })
  if (signInError) {
    throw new Error(`createTestUser signIn failed: ${signInError.message}`)
  }

  return { id: created.user.id, email, password, client }
}

/**
 * Best-effort cleanup. Deletes the auth user (CASCADE removes their
 * profile via the FK on profiles.id).
 */
export async function deleteTestUser(userId: string): Promise<void> {
  const admin = createAdminClient()
  await admin.auth.admin.deleteUser(userId)
}
