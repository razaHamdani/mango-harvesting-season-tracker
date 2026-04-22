'use server'

import { createClient } from '@/lib/supabase/server'
import { authLimiter, enforceLimit } from '@/lib/utils/rate-limiter'
import { getClientIpFromHeaders } from '@/lib/utils/client-ip'

const ALLOWED_ROLES = ['landlord'] as const
type AllowedRole = typeof ALLOWED_ROLES[number]

function isAllowedRole(role: unknown): role is AllowedRole {
  return ALLOWED_ROLES.includes(role as AllowedRole)
}

export async function signInUser(
  formData: FormData,
): Promise<{ error?: string }> {
  const supabase = await createClient()

  const { error } = await supabase.auth.signInWithPassword({
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  })

  if (error) {
    console.error('[signInUser] auth error', error.message)
    return { error: 'Invalid email or password.' }
  }
  return {}
}

export async function signUpUser(
  formData: FormData,
): Promise<{ error?: string }> {
  // Phase 1.8 — role allowlist. Reject unknown roles before touching Supabase.
  const role = formData.get('role') as string
  if (!isAllowedRole(role)) {
    return { error: 'Invalid role.' }
  }

  // Rate limit signups by IP (fail-closed)
  const ip = await getClientIpFromHeaders()
  const { allowed } = await enforceLimit(authLimiter, `ip:${ip}`)
  if (!allowed) return { error: 'Too many requests. Try again later.' }

  const supabase = await createClient()

  const { error } = await supabase.auth.signUp({
    email: formData.get('email') as string,
    password: formData.get('password') as string,
    options: {
      data: {
        full_name: formData.get('full_name') as string,
        role,
      },
    },
  })

  if (error) {
    console.error('[signUpUser] auth error', error.message)
    return { error: 'Failed to create account.' }
  }
  return {}
}
