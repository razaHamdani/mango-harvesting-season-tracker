import { beforeAll, beforeEach, afterAll, describe, expect, it } from 'vitest'
import { createAdminClient, resetDb } from './helpers/admin'
import { createTestUser, deleteTestUser, TestUser } from './helpers/user'
import { setCurrentClient, clearCurrentClient } from './setup'
import { createSeason, activateSeason, closeSeason } from '@/lib/actions/season-actions'

const BASE = {
  year: 2026,
  contractor_name: 'Test Contractor',
  predetermined_amount: 120_000,
  spray_landlord_pct: 50,
  fertilizer_landlord_pct: 50,
  agreed_boxes: 0,
  installments: [
    { amount: 60_000, due_date: '2026-05-01' },
    { amount: 60_000, due_date: '2026-08-01' },
  ],
}

describe('createSeason — RC-1 atomicity', () => {
  const admin = createAdminClient()
  let user: TestUser
  let farmId: string

  beforeEach(async () => {
    await resetDb(admin)
    if (user) await deleteTestUser(user.id)
    user = await createTestUser('season')
    setCurrentClient(user.client)

    const { data: farm } = await user.client
      .from('farms')
      .insert({ owner_id: user.id, name: 'Test Farm', acreage: 10 })
      .select('id')
      .single()
    if (!farm) throw new Error('farm insert failed')
    farmId = farm.id
  })

  afterAll(async () => {
    clearCurrentClient()
    if (user) await deleteTestUser(user.id)
  })

  async function assertZeroRows() {
    const [seasons, seasonFarms, installments] = await Promise.all([
      admin.from('seasons').select('id'),
      admin.from('season_farms').select('season_id'),
      admin.from('installments').select('id'),
    ])
    expect(seasons.data).toHaveLength(0)
    expect(seasonFarms.data).toHaveLength(0)
    expect(installments.data).toHaveLength(0)
  }

  it('rejects bad installment sum and leaves DB empty', async () => {
    const result = await createSeason({
      ...BASE,
      farm_ids: [farmId],
      installments: [
        { amount: 50_000, due_date: '2026-05-01' }, // 50k ≠ 120k
        { amount: 60_000, due_date: '2026-08-01' },
      ],
    })

    expect(result).toHaveProperty('error')
    expect((result as { error: Record<string, string[]> }).error._form[0]).toMatch(
      /installment amounts/i
    )
    await assertZeroRows()
  })

  it('creates season with all child rows on valid input', async () => {
    const result = await createSeason({ ...BASE, farm_ids: [farmId] })

    expect(result).toHaveProperty('id')
    const seasonId = (result as { id: string }).id

    const [seasons, seasonFarms, installments] = await Promise.all([
      admin.from('seasons').select('id, predetermined_amount').eq('id', seasonId),
      admin.from('season_farms').select('farm_id').eq('season_id', seasonId),
      admin.from('installments').select('expected_amount').eq('season_id', seasonId),
    ])

    expect(seasons.data).toHaveLength(1)
    expect(Number(seasons.data![0].predetermined_amount)).toBe(120_000)
    expect(seasonFarms.data).toHaveLength(1)
    expect(seasonFarms.data![0].farm_id).toBe(farmId)
    expect(installments.data).toHaveLength(2)
    const total = installments.data!.reduce(
      (s, r) => s + Number(r.expected_amount),
      0
    )
    expect(total).toBe(120_000)
  })

  it('rolls back entirely when a non-existent farm_id causes FK violation', async () => {
    const bogusId = '00000000-0000-0000-0000-000000000000'
    const result = await createSeason({
      ...BASE,
      farm_ids: [bogusId],
    })

    expect(result).toHaveProperty('error')
    await assertZeroRows()
  })
})

/**
 * 5D.4 — createSeason rejects a farm_id owned by a different user.
 *
 * The `create_season_with_children` RPC runs SECURITY INVOKER, so RLS
 * on `season_farms` applies. The farm FK is present in the DB but the
 * season_farms insert must be rejected because user A does not own the
 * farm or the season_farms policy blocks the cross-user reference.
 */
describe('createSeason — foreign farm_ids (5D.4)', () => {
  const admin = createAdminClient()
  let userA: TestUser
  let userB: TestUser
  let userBFarmId: string

  beforeAll(async () => {
    await resetDb(admin)
    userA = await createTestUser('season-4a')
    userB = await createTestUser('season-4b')

    const { data: farm } = await userB.client
      .from('farms')
      .insert({ owner_id: userB.id, name: "B's Farm", acreage: 10 })
      .select('id')
      .single()
    if (!farm) throw new Error('farm insert failed')
    userBFarmId = farm.id
  })

  afterAll(async () => {
    clearCurrentClient()
    if (userA) await deleteTestUser(userA.id)
    if (userB) await deleteTestUser(userB.id)
  })

  it('rejects when user A tries to create a season referencing user B farm ID', async () => {
    setCurrentClient(userA.client)
    const result = await createSeason({
      ...BASE,
      farm_ids: [userBFarmId],
    })

    expect(result).toHaveProperty('error')
  })
})

/**
 * 5D.5 — activateSeason concurrency guard.
 *
 * Two draft seasons activated concurrently must result in exactly one
 * active season. The partial unique index `one_active_season_per_owner`
 * enforces this atomically — no application-level pre-check can be as safe.
 */
describe('activateSeason — concurrency guard (5D.5)', () => {
  const admin = createAdminClient()
  let user: TestUser
  let draftId1: string
  let draftId2: string

  beforeAll(async () => {
    await resetDb(admin)
    user = await createTestUser('season-5')

    for (let i = 0; i < 2; i++) {
      const { data: s } = await admin
        .from('seasons')
        .insert({
          owner_id: user.id,
          year: 2026 + i,
          status: 'draft',
          contractor_name: `Contractor ${i}`,
          predetermined_amount: 100_000,
          spray_landlord_pct: 50,
          fertilizer_landlord_pct: 50,
          agreed_boxes: 0,
        })
        .select('id')
        .single()
      if (!s) throw new Error('season insert failed')
      if (i === 0) draftId1 = s.id
      else draftId2 = s.id
    }
  })

  afterAll(async () => {
    clearCurrentClient()
    if (user) await deleteTestUser(user.id)
  })

  it('allows exactly one activation when two drafts are activated concurrently', async () => {
    setCurrentClient(user.client)

    const [result1, result2] = await Promise.all([
      activateSeason(draftId1),
      activateSeason(draftId2),
    ])

    const results = [result1, result2]
    const successes = results.filter((r) => 'success' in r)
    const errors = results.filter((r) => 'error' in r)

    expect(successes).toHaveLength(1)
    expect(errors).toHaveLength(1)
    expect(
      (errors[0] as { error: Record<string, string[]> }).error._form[0]
    ).toMatch(/active season already exists/i)
  })
})

/**
 * 5D.7 — closeSeason warns when unpaid installments remain.
 *
 * The action must still close the season (status → 'closed') and return
 * { success: true, warning: '...' }. The warning message includes the count.
 */
describe('closeSeason — unpaid installment warning (5D.7)', () => {
  const admin = createAdminClient()
  let user: TestUser
  let seasonId: string

  beforeAll(async () => {
    await resetDb(admin)
    user = await createTestUser('season-7')

    const { data: season } = await admin
      .from('seasons')
      .insert({
        owner_id: user.id,
        year: 2026,
        status: 'active',
        started_at: '2026-01-01',
        contractor_name: 'Contractor',
        predetermined_amount: 120_000,
        spray_landlord_pct: 50,
        fertilizer_landlord_pct: 50,
        agreed_boxes: 0,
      })
      .select('id')
      .single()
    if (!season) throw new Error('season insert failed')
    seasonId = season.id

    // Two installments with no paid_amount (unpaid)
    await admin.from('installments').insert([
      {
        season_id: seasonId,
        installment_number: 1,
        expected_amount: 60_000,
        due_date: '2026-05-01',
        paid_amount: null,
      },
      {
        season_id: seasonId,
        installment_number: 2,
        expected_amount: 60_000,
        due_date: '2026-08-01',
        paid_amount: null,
      },
    ])
  })

  afterAll(async () => {
    clearCurrentClient()
    if (user) await deleteTestUser(user.id)
  })

  it('closes the season and returns a warning for 2 unpaid installments', async () => {
    setCurrentClient(user.client)
    const result = await closeSeason(seasonId)

    expect(result).toMatchObject({ success: true })
    expect((result as { warning?: string }).warning).toMatch(/2 installment/)

    const { data: row } = await admin
      .from('seasons')
      .select('status')
      .eq('id', seasonId)
      .single()
    expect(row?.status).toBe('closed')
  })
})

/**
 * Phase 10 — started_at is set on activation.
 *
 * Draft seasons have started_at = null. activateSeason populates it with
 * today's date (UTC). The value persists through closeSeason.
 */
describe('activateSeason — started_at population (Phase 10)', () => {
  const admin = createAdminClient()
  let user: TestUser
  let seasonId: string

  beforeAll(async () => {
    await resetDb(admin)
    user = await createTestUser('season-started-at')

    const { data: season } = await admin
      .from('seasons')
      .insert({
        owner_id: user.id,
        year: 2026,
        status: 'draft',
        contractor_name: 'Started-at Contractor',
        predetermined_amount: 100_000,
        spray_landlord_pct: 50,
        fertilizer_landlord_pct: 50,
        agreed_boxes: 0,
      })
      .select('id')
      .single()
    if (!season) throw new Error('season insert failed')
    seasonId = season.id
  })

  afterAll(async () => {
    clearCurrentClient()
    if (user) await deleteTestUser(user.id)
  })

  it('starts as null on a draft, gets today on activation, and survives close', async () => {
    // Draft → null
    const { data: pre } = await admin
      .from('seasons')
      .select('started_at')
      .eq('id', seasonId)
      .single()
    expect(pre?.started_at).toBeNull()

    // Activate
    setCurrentClient(user.client)
    const today = new Date().toISOString().slice(0, 10)
    const activateResult = await activateSeason(seasonId)
    expect(activateResult).toMatchObject({ success: true })

    const { data: active } = await admin
      .from('seasons')
      .select('started_at, status')
      .eq('id', seasonId)
      .single()
    expect(active?.status).toBe('active')
    expect(active?.started_at).toBe(today)

    // Close → started_at retained
    const closeResult = await closeSeason(seasonId)
    expect(closeResult).toMatchObject({ success: true })

    const { data: closed } = await admin
      .from('seasons')
      .select('started_at, status')
      .eq('id', seasonId)
      .single()
    expect(closed?.status).toBe('closed')
    expect(closed?.started_at).toBe(today)
  })
})
