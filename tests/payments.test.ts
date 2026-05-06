import { beforeEach, beforeAll, afterAll, describe, expect, it } from 'vitest'
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
        started_at: '2026-01-01',
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

  it('allows the legitimate owner to record payment', async () => {
    const fd = new FormData()
    fd.set('amount', '100000')
    fd.set('paid_date', '2026-05-20')
    const result = await recordPayment(installmentId, fd, seasonId)
    expect('success' in result && result.success).toBe(true)
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

describe('recordPayment — ownership guard', () => {
  const admin = createAdminClient()
  let userA: TestUser
  let userB: TestUser
  let userASeasonId: string
  let userAInstallmentId: string

  beforeAll(async () => {
    await resetDb(admin)
    userA = await createTestUser('payment-owner-a')
    userB = await createTestUser('payment-owner-b')

    // Seed: farm + season + installment owned by user A (use admin to bypass RLS)
    const { data: farm } = await admin
      .from('farms')
      .insert({ owner_id: userA.id, name: 'A Farm', acreage: 10 })
      .select('id')
      .single()
    if (!farm) throw new Error('farm seed failed')

    const { data: season } = await admin
      .from('seasons')
      .insert({
        owner_id: userA.id,
        year: 2026,
        status: 'active',
        started_at: '2026-01-01',
        contractor_name: 'A Contractor',
        predetermined_amount: 100_000,
        spray_landlord_pct: 100,
        fertilizer_landlord_pct: 100,
        agreed_boxes: 0,
      })
      .select('id')
      .single()
    if (!season) throw new Error('season seed failed')
    userASeasonId = season.id

    await admin
      .from('season_farms')
      .insert({ season_id: userASeasonId, farm_id: farm.id })

    const { data: inst } = await admin
      .from('installments')
      .insert({
        season_id: userASeasonId,
        installment_number: 1,
        expected_amount: 100_000,
        due_date: '2026-06-01',
      })
      .select('id')
      .single()
    if (!inst) throw new Error('installment seed failed')
    userAInstallmentId = inst.id
  })

  afterAll(async () => {
    clearCurrentClient()
    if (userA) await deleteTestUser(userA.id)
    if (userB) await deleteTestUser(userB.id)
  })

  it('rejects when user B tries to record payment for user A season', async () => {
    setCurrentClient(userB.client)

    const fd = new FormData()
    fd.set('amount', '50000')
    fd.set('paid_date', '2026-05-20')

    const result = await recordPayment(userAInstallmentId, fd, userASeasonId)

    expect(result).toHaveProperty('error')
    expect((result as { error: string }).error).toBe('Season not found.')

    // Installment must remain unpaid
    const { data: row } = await admin
      .from('installments')
      .select('paid_amount')
      .eq('id', userAInstallmentId)
      .single()
    expect(row).not.toBeNull()
    expect(row!.paid_amount).toBeNull()
  })
})

/**
 * Phase 10 — recordPayment rejects paid_date before season started_at, and
 * rejects payments against a draft season.
 */
describe('recordPayment — season window guard (Phase 10)', () => {
  const admin = createAdminClient()
  let user: TestUser
  let activeSeasonId: string
  let activeInstallmentId: string
  let draftSeasonId: string
  let draftInstallmentId: string

  beforeAll(async () => {
    await resetDb(admin)
    user = await createTestUser('pay-window')

    const { data: active } = await admin
      .from('seasons')
      .insert({
        owner_id: user.id,
        year: 2026,
        status: 'active',
        started_at: '2026-04-01',
        contractor_name: 'Active C',
        predetermined_amount: 50_000,
        spray_landlord_pct: 100,
        fertilizer_landlord_pct: 100,
        agreed_boxes: 0,
      })
      .select('id').single()
    if (!active) throw new Error('active season seed failed')
    activeSeasonId = active.id
    const { data: activeInst } = await admin
      .from('installments')
      .insert({
        season_id: activeSeasonId,
        installment_number: 1,
        expected_amount: 50_000,
        due_date: '2026-06-01',
      })
      .select('id').single()
    if (!activeInst) throw new Error('active installment seed failed')
    activeInstallmentId = activeInst.id

    const { data: draft } = await admin
      .from('seasons')
      .insert({
        owner_id: user.id,
        year: 2027,
        status: 'draft',
        contractor_name: 'Draft C',
        predetermined_amount: 50_000,
        spray_landlord_pct: 100,
        fertilizer_landlord_pct: 100,
        agreed_boxes: 0,
      })
      .select('id').single()
    if (!draft) throw new Error('draft season seed failed')
    draftSeasonId = draft.id
    const { data: draftInst } = await admin
      .from('installments')
      .insert({
        season_id: draftSeasonId,
        installment_number: 1,
        expected_amount: 50_000,
        due_date: '2027-06-01',
      })
      .select('id').single()
    if (!draftInst) throw new Error('draft installment seed failed')
    draftInstallmentId = draftInst.id
  })

  afterAll(async () => {
    clearCurrentClient()
    if (user) await deleteTestUser(user.id)
  })

  function makeFormData(paidDate: string) {
    const fd = new FormData()
    fd.set('amount', '50000')
    fd.set('paid_date', paidDate)
    return fd
  }

  it('rejects payment dated before season started_at', async () => {
    setCurrentClient(user.client)
    const result = await recordPayment(activeInstallmentId, makeFormData('2026-03-15'), activeSeasonId)
    expect(result).toHaveProperty('error')
    expect((result as { error: string }).error).toMatch(/on or after the season start/i)
  })

  it('rejects any payment against a draft season', async () => {
    setCurrentClient(user.client)
    const result = await recordPayment(draftInstallmentId, makeFormData('2027-04-01'), draftSeasonId)
    expect(result).toHaveProperty('error')
    expect((result as { error: string }).error).toMatch(/season is not active/i)
  })

  it('accepts payment dated on or after season started_at', async () => {
    setCurrentClient(user.client)
    const result = await recordPayment(activeInstallmentId, makeFormData('2026-05-15'), activeSeasonId)
    expect(result).toMatchObject({ success: true })
  })
})

describe('recordPayment — amount validation (Phase 11C)', () => {
  const admin = createAdminClient()
  let user: TestUser
  let seasonId: string
  let installmentId: string

  beforeEach(async () => {
    await resetDb(admin)
    if (user) await deleteTestUser(user.id)
    user = await createTestUser('pay-validation')
    setCurrentClient(user.client)

    const { data: farm } = await user.client
      .from('farms')
      .insert({ owner_id: user.id, name: 'Val Farm', acreage: 10 })
      .select('id')
      .single()
    if (!farm) throw new Error('farm insert failed')

    const { data: season } = await user.client
      .from('seasons')
      .insert({
        owner_id: user.id,
        year: 2026,
        status: 'active',
        started_at: '2026-01-01',
        contractor_name: 'Val Contractor',
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

  function makeFormData(amount: string, paidDate = '2026-05-20') {
    const fd = new FormData()
    fd.set('amount', amount)
    fd.set('paid_date', paidDate)
    return fd
  }

  it('rejects "100abc" amount', async () => {
    const result = await recordPayment(installmentId, makeFormData('100abc'), seasonId)
    expect(result).toHaveProperty('error')
    const err = (result as { error: unknown }).error
    expect(typeof err).toBe('string')
    expect(err as string).toMatch(/number|valid/i)
  })

  it('rejects negative amount', async () => {
    const result = await recordPayment(installmentId, makeFormData('-5'), seasonId)
    expect(result).toHaveProperty('error')
    const err = (result as { error: unknown }).error
    expect(typeof err).toBe('string')
    expect(err as string).toMatch(/greater than 0/i)
  })

  it('rejects empty amount', async () => {
    const result = await recordPayment(installmentId, makeFormData(''), seasonId)
    expect(result).toHaveProperty('error')
    const err = (result as { error: unknown }).error
    expect(typeof err).toBe('string')
  })

  it('rejects zero amount', async () => {
    const result = await recordPayment(installmentId, makeFormData('0'), seasonId)
    expect(result).toHaveProperty('error')
    const err = (result as { error: unknown }).error
    expect(typeof err).toBe('string')
    expect(err as string).toMatch(/greater than 0/i)
  })
})
