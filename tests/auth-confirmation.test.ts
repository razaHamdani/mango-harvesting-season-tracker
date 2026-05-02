/**
 * 6C — Email confirmation integration tests.
 *
 * With enable_confirmations = true, signing up via the action returns
 * pendingConfirmation=true. Only after the email is confirmed (simulated
 * here via the admin API) can the user sign in.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './helpers/env'
import { createAdminClient } from './helpers/admin'

// Stub next/headers-dependent utilities so the server action can run.
vi.mock('@/lib/utils/client-ip', () => ({
  getClientIpFromHeaders: async () => '127.0.0.1',
  getClientIp: () => '127.0.0.1',
}))

// Keep EMAIL_RE real (format tests rely on it) but stub the DNS lookup so
// @example.com addresses pass without a live MX query.
vi.mock('@/lib/utils/email-validation', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/utils/email-validation')>()
  return { ...real, hasMxRecords: async () => true }
})

import { signUpUser, signInUser, resendConfirmation } from '@/lib/actions/auth-actions'
import { setCurrentClient, clearCurrentClient } from './setup'

const admin = createAdminClient()

// Track users created in this suite for cleanup.
const createdUserIds: string[] = []

afterAll(async () => {
  for (const id of createdUserIds) {
    await admin.auth.admin.deleteUser(id)
  }
  clearCurrentClient()
})

describe('email confirmation (6C)', () => {
  it('sign-up returns pendingConfirmation=true when email not yet confirmed', async () => {
    const suffix = Math.random().toString(36).slice(2, 8)
    const email = `confirm-test-${suffix}@example.com`
    const password = `P@ssw0rd-${suffix}`

    // Provide an anon client for the action; it will call supabase.auth.signUp
    const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    setCurrentClient(anonClient)

    const fd = new FormData()
    fd.set('email', email)
    fd.set('password', password)
    fd.set('full_name', 'Confirm Tester')
    fd.set('role', 'landlord')

    const result = await signUpUser(fd)
    expect(result.error).toBeUndefined()
    expect(result.pendingConfirmation).toBe(true)

    // Record the created user for cleanup.
    const { data } = await admin.auth.admin.listUsers()
    const created = data.users.find((u) => u.email === email)
    if (created) createdUserIds.push(created.id)

    // Sign-in must fail before confirmation.
    setCurrentClient(anonClient)
    const fd2 = new FormData()
    fd2.set('email', email)
    fd2.set('password', password)
    const signInResult = await signInUser(fd2)
    expect(signInResult.error).toBeDefined()
  })

  it('returns error for malformed email address', async () => {
    const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    setCurrentClient(anonClient)

    const fd = new FormData()
    fd.set('email', 'not-an-email')
    fd.set('password', 'P@ssw0rd123')
    fd.set('full_name', 'Bad Email')
    fd.set('role', 'landlord')

    const result = await signUpUser(fd)
    expect(result.error).toBe('Enter a valid email address.')
    expect(result.pendingConfirmation).toBeUndefined()
  })

  it('returns error when email is already registered', async () => {
    const suffix = Math.random().toString(36).slice(2, 8)
    const email = `dup-${suffix}@example.com`
    const password = `P@ssw0rd-${suffix}`

    const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    setCurrentClient(anonClient)

    const fd = () => {
      const f = new FormData()
      f.set('email', email)
      f.set('password', password)
      f.set('full_name', 'Dup Tester')
      f.set('role', 'landlord')
      return f
    }

    // First signup — should succeed with pending confirmation.
    const first = await signUpUser(fd())
    expect(first.error).toBeUndefined()
    expect(first.pendingConfirmation).toBe(true)

    // Record for cleanup.
    const { data } = await admin.auth.admin.listUsers()
    const created = data.users.find((u) => u.email === email)
    if (created) createdUserIds.push(created.id)

    // Second signup with same email — RPC pre-check surfaces this before signUp.
    const second = await signUpUser(fd())
    expect(second.error).toBe('Email already registered.')
    expect(second.pendingConfirmation).toBeUndefined()
  })

  it('sign-in succeeds after admin-confirms the user', async () => {
    const suffix = Math.random().toString(36).slice(2, 8)
    const email = `confirm-ok-${suffix}@example.com`
    const password = `P@ssw0rd-${suffix}`

    // Create unconfirmed user via the anon signUp path.
    const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    setCurrentClient(anonClient)

    const fd = new FormData()
    fd.set('email', email)
    fd.set('password', password)
    fd.set('full_name', 'Confirmed User')
    fd.set('role', 'landlord')

    const result = await signUpUser(fd)
    expect(result.pendingConfirmation).toBe(true)

    // Retrieve the user ID.
    const { data: list } = await admin.auth.admin.listUsers()
    const created = list.users.find((u) => u.email === email)
    expect(created).toBeDefined()
    createdUserIds.push(created!.id)

    // Confirm via admin API (simulates the user clicking the email link).
    await admin.auth.admin.updateUserById(created!.id, {
      email_confirm: true,
    })

    // Sign-in must now succeed.
    setCurrentClient(anonClient)
    const fd2 = new FormData()
    fd2.set('email', email)
    fd2.set('password', password)
    const signInResult = await signInUser(fd2)
    expect(signInResult.error).toBeUndefined()
  })
})

describe('resendConfirmation — constant response (7C)', () => {
  it('returns identical { ok: true } for a known email', async () => {
    const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    setCurrentClient(anonClient)

    // Create an unconfirmed user so this is a "known" email.
    const suffix = Math.random().toString(36).slice(2, 8)
    const email = `resend-known-${suffix}@example.com`
    const fd = new FormData()
    fd.set('email', email)
    fd.set('password', `P@ssw0rd-${suffix}`)
    fd.set('full_name', 'Resend Test')
    fd.set('role', 'landlord')
    await signUpUser(fd)
    const { data } = await admin.auth.admin.listUsers()
    const created = data.users.find((u) => u.email === email)
    if (created) createdUserIds.push(created.id)

    setCurrentClient(anonClient)
    const result = await resendConfirmation(email)
    expect(result).toEqual({ ok: true })
  })

  it('returns identical { ok: true } for an unknown email', async () => {
    const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    setCurrentClient(anonClient)

    const result = await resendConfirmation('nobody-does-not-exist-99999@example.com')
    expect(result).toEqual({ ok: true })
  })
})
