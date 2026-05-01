'use server'

import { createClient } from '@/lib/supabase/server'
import { authLimiter, enforceLimit } from '@/lib/utils/rate-limiter'
import { getClientIpFromHeaders } from '@/lib/utils/client-ip'

const ALLOWED_ROLES = ['landlord'] as const
type AllowedRole = typeof ALLOWED_ROLES[number]

// RFC 5322-inspired check: local@domain.tld with no whitespace.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function isAllowedRole(role: unknown): role is AllowedRole {
  return ALLOWED_ROLES.includes(role as AllowedRole)
}

export async function signInUser(
  formData: FormData,
): Promise<{ error?: string }> {
  // Rate limit sign-in by IP (fail-closed) — mirrors signUpUser.
  // Defends against credential-stuffing in addition to Supabase's own
  // sign_in_sign_ups limit.
  const ip = await getClientIpFromHeaders()
  const { allowed } = await enforceLimit(authLimiter, `ip:${ip}`)
  if (!allowed) return { error: 'Too many requests. Try again later.' }

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
): Promise<{ error?: string; pendingConfirmation?: boolean }> {
  // Phase 1.8 — role allowlist. Reject unknown roles before touching Supabase.
  const role = formData.get('role') as string
  if (!isAllowedRole(role)) {
    return { error: 'Invalid role.' }
  }

  const email = (formData.get('email') as string).trim()
  if (!EMAIL_RE.test(email)) {
    return { error: 'Enter a valid email address.' }
  }

  // Rate limit signups by IP (fail-closed)
  const ip = await getClientIpFromHeaders()
  const { allowed } = await enforceLimit(authLimiter, `ip:${ip}`)
  if (!allowed) return { error: 'Too many requests. Try again later.' }

  const supabase = await createClient()

  // Explicit duplicate-email pre-check. Fail-closed: if the RPC itself errors,
  // do not proceed to signUp (unknown state is worse than a retry prompt).
  const { data: exists, error: rpcError } = await supabase.rpc('email_exists', { check_email: email })
  if (rpcError) {
    console.error('[signUpUser] email_exists rpc error', rpcError.message)
    return { error: 'Something went wrong, please try again.' }
  }
  if (exists === true) {
    return { error: 'Email already registered.' }
  }

  const { data, error } = await supabase.auth.signUp({
    email,
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

  // When email confirmation is enabled, the session is null until the user
  // clicks the confirmation link. Signal the UI to show a pending state.
  if (!data.session) {
    return { pendingConfirmation: true }
  }

  return {}
}

export async function resendConfirmation(
  email: string,
): Promise<{ ok: true }> {
  // Rate-limit by IP — same budget as signIn/signUp to prevent mailer abuse.
  const ip = await getClientIpFromHeaders()
  const { allowed } = await enforceLimit(authLimiter, `ip:${ip}`)
  if (!allowed) return { ok: true }  // constant response — never reveal rate-limit status

  const supabase = await createClient()
  // Fire-and-forget: always return the same response regardless of outcome.
  // This prevents email enumeration (Supabase's resend response differs for known vs unknown emails).
  const { error } = await supabase.auth.resend({ type: 'signup', email })
  if (error) {
    console.error('[resendConfirmation] error', error.message)
  }
  return { ok: true }
}
