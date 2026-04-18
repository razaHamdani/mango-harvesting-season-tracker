import { beforeEach, afterAll, describe, expect, it } from 'vitest'
import { createAdminClient, resetDb } from './helpers/admin'
import { createTestUser, deleteTestUser, TestUser } from './helpers/user'
import { setCurrentClient, clearCurrentClient } from './setup'
import { recordPayment } from '@/lib/actions/payment-actions'

describe('recordPayment — RC-2 TOCTOU', () => {
  const admin = createAdminClient()
  let user: TestUser
  let seasonId: string
  let installmentId: string

  beforeEach(async () => {
    await resetDb(admin)
    if (user) await deleteTestUser(user.id)
    user = await createTestUser('payment')
    setCurrentClient(user.client)

    // Seed: farm -> season -> installment (all owned by user)
    const { data: farm } = await user.client
      .from('farms')
      .insert({ owner_id: user.id, name: 'Test Farm', acreage: 10 })
      .select('id')
      .single()
    if (!farm) throw new Error('farm insert failed')

    const { data: season } = await user.client
      .from('seasons')
      .insert({
        owner_id: user.id,
        year: 2026,
        status: 'active',
        contractor_name: 'Test Contractor',
        predetermined_amount: 100_000,
        spray_landlord_pct: 100,
        fertilizer_landlord_pct: 100,
        agreed_boxes: 0,
      })
      .select('id')
      .single()
    if (!season) throw new Error('season insert failed')
    seasonId = season.id

    await user.client
      .from('season_farms')
      .insert({ season_id: seasonId, farm_id: farm.id })

    const { data: inst } = await user.client
      .from('installments')
      .insert({
        season_id: seasonId,
        installment_number: 1,
        expected_amount: 100_000,
        due_date: '2026-06-01',
      })
      .select('id')
      .single()
    if (!inst) throw new Error('installment insert failed')
    installmentId = inst.id
  })

  afterAll(async () => {
    clearCurrentClient()
    if (user) await deleteTestUser(user.id)
  })

  it('rejects the second of two concurrent recordings', async () => {
    const mk = (amount: number) => {
      const fd = new FormData()
      fd.set('amount', String(amount))
      fd.set('paid_date', '2026-05-20')
      fd.set('notes', `amount=${amount}`)
      return fd
    }

    const [a, b] = await Promise.all([
      recordPayment(installmentId, mk(50_000), seasonId),
      recordPayment(installmentId, mk(60_000), seasonId),
    ])

    const successes = [a, b].filter((r) => 'success' in r && r.success)
    const errors = [a, b].filter((r) => 'error' in r && r.error)

    expect(successes).toHaveLength(1)
    expect(errors).toHaveLength(1)
    expect(errors[0].error).toMatch(/already been recorded/i)

    // DB should reflect exactly one recorded amount (either 50k or 60k,
    // whichever won), not both and not a mix.
    const { data: row } = await admin
      .from('installments')
      .select('paid_amount, notes')
      .eq('id', installmentId)
      .single()
    expect(row).not.toBeNull()
    expect([50_000, 60_000]).toContain(Number(row!.paid_amount))
    expect(row!.notes).toMatch(/^amount=(50000|60000)$/)
  })

  it('rejects a second sequential recording', async () => {
    const mk = (amount: number) => {
      const fd = new FormData()
      fd.set('amount', String(amount))
      fd.set('paid_date', '2026-05-20')
      return fd
    }

    const first = await recordPayment(installmentId, mk(100_000), seasonId)
    expect('success' in first && first.success).toBe(true)

    const second = await recordPayment(installmentId, mk(42_000), seasonId)
    expect('error' in second && second.error).toMatch(/already been recorded/i)

    const { data: row } = await admin
      .from('installments')
      .select('paid_amount')
      .eq('id', installmentId)
      .single()
    expect(Number(row!.paid_amount)).toBe(100_000)
  })
})
