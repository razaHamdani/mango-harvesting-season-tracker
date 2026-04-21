import { beforeEach, afterAll, describe, expect, it } from 'vitest'
import { createAdminClient, resetDb } from './helpers/admin'
import { createTestUser, deleteTestUser, TestUser } from './helpers/user'
import { setCurrentClient, clearCurrentClient } from './setup'
import { ensureProfile } from '@/lib/queries/profile-queries'

describe('profiles', () => {
  const admin = createAdminClient()
  let user: TestUser

  beforeEach(async () => {
    await resetDb(admin)
    if (user) await deleteTestUser(user.id)
    user = await createTestUser('profile')
    setCurrentClient(user.client)
  })

  afterAll(async () => {
    clearCurrentClient()
    if (user) await deleteTestUser(user.id)
  })

  it('auto-creates a profile with role landlord on signup', async () => {
    const { data, error } = await admin
      .from('profiles')
      .select('id, role, full_name')
      .eq('id', user.id)
      .single()

    expect(error).toBeNull()
    expect(data).not.toBeNull()
    expect(data!.role).toBe('landlord')
  })

  it('allows user to update their own full_name and phone', async () => {
    const { error } = await user.client
      .from('profiles')
      .update({ full_name: 'Raza Hamdani', phone: '0300-1234567' })
      .eq('id', user.id)

    expect(error).toBeNull()

    const { data } = await admin
      .from('profiles')
      .select('full_name, phone')
      .eq('id', user.id)
      .single()

    expect(data!.full_name).toBe('Raza Hamdani')
    expect(data!.phone).toBe('0300-1234567')
  })

  it('stores role from signup metadata', async () => {
    const admin = createAdminClient()
    const suffix = Math.random().toString(36).slice(2, 10)
    const { data: created } = await admin.auth.admin.createUser({
      email: `test-rolemeta-${suffix}@example.com`,
      password: `pass-${suffix}`,
      email_confirm: true,
      user_metadata: { full_name: 'Role Test', role: 'landlord' },
    })
    const userId = created!.user!.id
    const { data } = await admin
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single()
    expect(data!.role).toBe('landlord')
    await admin.auth.admin.deleteUser(userId)
  })

  it('ensureProfile creates profile for user missing one', async () => {
    const admin = createAdminClient()
    // Delete the profile but keep auth user
    await admin.from('profiles').delete().eq('id', user.id)

    // ensureProfile should recreate it
    await ensureProfile()

    const { data } = await admin
      .from('profiles')
      .select('id')
      .eq('id', user.id)
      .single()
    expect(data).not.toBeNull()
    expect(data!.id).toBe(user.id)
  })

  it('blocks user from self-elevating their own role', async () => {
    const { error } = await user.client
      .from('profiles')
      .update({ role: 'admin' })
      .eq('id', user.id)

    expect(error).not.toBeNull()
    expect(error!.message).toMatch(/role can only be changed by admin/i)
  })
})
