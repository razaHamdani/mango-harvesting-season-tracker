import { beforeEach, beforeAll, afterAll, describe, expect, it } from 'vitest'
import { createAdminClient, resetDb } from './helpers/admin'
import { createTestUser, deleteTestUser, TestUser } from './helpers/user'
import { setCurrentClient, clearCurrentClient } from './setup'
import { createExpense, deleteExpense } from '@/lib/actions/expense-actions'
import { getExpenses } from '@/lib/queries/expense-queries'

describe('createExpense', () => {
  const admin = createAdminClient()
  let user: TestUser
  let seasonId: string
  let farmId: string
  let activityId: string

  beforeEach(async () => {
    await resetDb(admin)
    if (user) await deleteTestUser(user.id)
    user = await createTestUser('expense')
    setCurrentClient(user.client)

    const { data: farm } = await user.client
      .from('farms')
      .insert({ owner_id: user.id, name: 'Mango Farm', acreage: 5 })
      .select('id')
      .single()
    if (!farm) throw new Error('farm insert failed')
    farmId = farm.id

    const { data: season } = await user.client
      .from('seasons')
      .insert({
        owner_id: user.id,
        year: 2026,
        status: 'active',
        started_at: '2026-01-01',
        contractor_name: 'Ali',
        predetermined_amount: 200_000,
        spray_landlord_pct: 50,
        fertilizer_landlord_pct: 100,
        agreed_boxes: 0,
      })
      .select('id')
      .single()
    if (!season) throw new Error('season insert failed')
    seasonId = season.id

    await user.client
      .from('season_farms')
      .insert({ season_id: seasonId, farm_id: farmId })

    const { data: activity } = await user.client
      .from('activities')
      .insert({
        season_id: seasonId,
        farm_id: farmId,
        type: 'spray',
        activity_date: '2026-05-01',
        description: 'First spray',
      })
      .select('id')
      .single()
    if (!activity) throw new Error('activity insert failed')
    activityId = activity.id
  })

  afterAll(async () => {
    clearCurrentClient()
    if (user) await deleteTestUser(user.id)
  })

  it('stores linked_activity_id when provided', async () => {
    const fd = new FormData()
    fd.set('category', 'spray')
    fd.set('amount', '5000')
    fd.set('expense_date', '2026-05-02')
    fd.set('farm_id', farmId)
    fd.set('description', '')
    fd.set('linked_activity_id', activityId)

    const result = await createExpense(fd, seasonId)

    expect(result).toMatchObject({ success: true })

    const { data: row } = await admin
      .from('expenses')
      .select('linked_activity_id, amount, landlord_cost')
      .eq('season_id', seasonId)
      .single()

    expect(row).not.toBeNull()
    expect(row!.linked_activity_id).toBe(activityId)
    expect(Number(row!.amount)).toBe(5000)
    expect(Number(row!.landlord_cost)).toBe(2500) // 50% landlord for spray
  })

  it('stores null for linked_activity_id when omitted', async () => {
    const fd = new FormData()
    fd.set('category', 'labor')
    fd.set('amount', '3000')
    fd.set('expense_date', '2026-05-03')
    fd.set('farm_id', '')
    fd.set('description', '')

    const result = await createExpense(fd, seasonId)
    expect(result).toMatchObject({ success: true })

    const { data: row } = await admin
      .from('expenses')
      .select('linked_activity_id')
      .eq('season_id', seasonId)
      .single()

    expect(row!.linked_activity_id).toBeNull()
  })

  it('rejects negative amount via Zod validation', async () => {
    const fd = new FormData()
    fd.set('category', 'labor')
    fd.set('amount', '-100')
    fd.set('expense_date', '2026-05-03')
    fd.set('farm_id', '')
    fd.set('description', '')

    const result = await createExpense(fd, seasonId)
    expect(result).toHaveProperty('error')
    expect((result as { error: unknown }).error).toMatchObject({
      amount: expect.arrayContaining([expect.stringMatching(/greater than 0/i)]),
    })
  })
})

/**
 * Phase 1.2 — IDOR in deleteExpense.
 * User B must not be able to delete User A's expense by guessing its UUID.
 */
describe('deleteExpense — IDOR protection', () => {
  const admin = createAdminClient()
  let userA: TestUser
  let userB: TestUser
  let userASeasonId: string
  let userAExpenseId: string

  beforeAll(async () => {
    await resetDb(admin)
    userA = await createTestUser('expense-a')
    userB = await createTestUser('expense-b')

    // Seed: farm + season + expense owned by user A
    const { data: farm } = await admin
      .from('farms')
      .insert({ owner_id: userA.id, name: 'A Farm', acreage: 5 })
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
        spray_landlord_pct: 50,
        fertilizer_landlord_pct: 50,
        agreed_boxes: 0,
      })
      .select('id')
      .single()
    if (!season) throw new Error('season seed failed')
    userASeasonId = season.id

    await admin
      .from('season_farms')
      .insert({ season_id: userASeasonId, farm_id: farm.id })

    const { data: expense } = await admin
      .from('expenses')
      .insert({
        season_id: userASeasonId,
        category: 'labor',
        amount: 5000,
        landlord_cost: 5000,
        expense_date: '2026-05-01',
      })
      .select('id')
      .single()
    if (!expense) throw new Error('expense seed failed')
    userAExpenseId = expense.id
  })

  afterAll(async () => {
    clearCurrentClient()
    if (userA) await deleteTestUser(userA.id)
    if (userB) await deleteTestUser(userB.id)
  })

  it('rejects when user B tries to delete user A expense', async () => {
    // Run as user B
    setCurrentClient(userB.client)
    const result = await deleteExpense(userAExpenseId, userASeasonId)

    expect(result).toHaveProperty('error')
    expect(typeof (result as { error: string }).error).toBe('string')

    // Row must still exist
    const { data: row } = await admin
      .from('expenses')
      .select('id')
      .eq('id', userAExpenseId)
      .single()
    expect(row).not.toBeNull()
  })

  it('allows the legitimate owner to delete their own expense', async () => {
    // Run as user A
    setCurrentClient(userA.client)
    const result = await deleteExpense(userAExpenseId, userASeasonId)

    expect(result).toMatchObject({ success: true })

    // Row must be gone
    const { data: row } = await admin
      .from('expenses')
      .select('id')
      .eq('id', userAExpenseId)
      .maybeSingle()
    expect(row).toBeNull()
  })
})

describe('getExpenses — ownership guard', () => {
  const admin = createAdminClient()
  let userA: TestUser
  let userB: TestUser
  let userASeasonId: string

  beforeAll(async () => {
    await resetDb(admin)
    userA = await createTestUser('get-expense-a')
    userB = await createTestUser('get-expense-b')

    // Seed: farm + season + expense owned by user A
    const { data: farm } = await admin
      .from('farms')
      .insert({ owner_id: userA.id, name: 'A Farm', acreage: 5 })
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
        spray_landlord_pct: 50,
        fertilizer_landlord_pct: 50,
        agreed_boxes: 0,
      })
      .select('id')
      .single()
    if (!season) throw new Error('season seed failed')
    userASeasonId = season.id

    await admin
      .from('season_farms')
      .insert({ season_id: userASeasonId, farm_id: farm.id })

    await admin
      .from('expenses')
      .insert({
        season_id: userASeasonId,
        category: 'labor',
        amount: 5000,
        landlord_cost: 2500,
        expense_date: '2026-05-01',
      })
  })

  afterAll(async () => {
    clearCurrentClient()
    if (userA) await deleteTestUser(userA.id)
    if (userB) await deleteTestUser(userB.id)
  })

  it('returns empty page when user B requests user A season expenses', async () => {
    setCurrentClient(userB.client)
    const result = await getExpenses(userASeasonId)

    expect(result).toEqual({ items: [], nextCursor: null })
  })
})

/**
 * 5D.3 — createExpense rejects a linked_activity_id owned by a different user.
 *
 * User A creates an expense in their own season but supplies user B's activity
 * UUID as linked_activity_id. The ownership check in createExpense must reject
 * this with "Linked activity not found."
 */
describe('createExpense — foreign linked_activity_id (5D.3)', () => {
  const admin = createAdminClient()
  let userA: TestUser
  let userB: TestUser
  let userASeasonId: string
  let userBActivityId: string

  beforeAll(async () => {
    await resetDb(admin)
    userA = await createTestUser('exp-5d3-a')
    userB = await createTestUser('exp-5d3-b')

    // User A: farm + season
    const { data: farmA } = await admin
      .from('farms')
      .insert({ owner_id: userA.id, name: 'A Farm', acreage: 5 })
      .select('id')
      .single()
    if (!farmA) throw new Error('farmA insert failed')

    const { data: seasonA } = await admin
      .from('seasons')
      .insert({
        owner_id: userA.id,
        year: 2026,
        status: 'active',
        started_at: '2026-01-01',
        contractor_name: 'A',
        predetermined_amount: 100_000,
        spray_landlord_pct: 50,
        fertilizer_landlord_pct: 50,
        agreed_boxes: 0,
      })
      .select('id')
      .single()
    if (!seasonA) throw new Error('seasonA insert failed')
    userASeasonId = seasonA.id
    await admin.from('season_farms').insert({ season_id: userASeasonId, farm_id: farmA.id })

    // User B: farm + season + activity
    const { data: farmB } = await admin
      .from('farms')
      .insert({ owner_id: userB.id, name: 'B Farm', acreage: 5 })
      .select('id')
      .single()
    if (!farmB) throw new Error('farmB insert failed')

    const { data: seasonB } = await admin
      .from('seasons')
      .insert({
        owner_id: userB.id,
        year: 2026,
        status: 'active',
        started_at: '2026-01-01',
        contractor_name: 'B',
        predetermined_amount: 100_000,
        spray_landlord_pct: 50,
        fertilizer_landlord_pct: 50,
        agreed_boxes: 0,
      })
      .select('id')
      .single()
    if (!seasonB) throw new Error('seasonB insert failed')

    const { data: activityB } = await admin
      .from('activities')
      .insert({
        season_id: seasonB.id,
        farm_id: farmB.id,
        type: 'spray',
        activity_date: '2026-05-01',
        description: 'B spray',
      })
      .select('id')
      .single()
    if (!activityB) throw new Error('activityB insert failed')
    userBActivityId = activityB.id
  })

  afterAll(async () => {
    clearCurrentClient()
    if (userA) await deleteTestUser(userA.id)
    if (userB) await deleteTestUser(userB.id)
  })

  it('rejects "Linked activity not found" when activity belongs to a different user', async () => {
    setCurrentClient(userA.client)
    const fd = new FormData()
    fd.set('category', 'spray')
    fd.set('amount', '5000')
    fd.set('expense_date', '2026-05-02')
    fd.set('farm_id', '')
    fd.set('description', '')
    fd.set('linked_activity_id', userBActivityId)

    const result = await createExpense(fd, userASeasonId)

    expect(result).toHaveProperty('error')
    expect((result as { error: string }).error).toBe('Linked activity not found.')
  })
})

describe('getExpenses — linked activity', () => {
  const admin = createAdminClient()
  let user: TestUser
  let seasonId: string
  let farmId: string
  let activityId: string

  beforeAll(async () => {
    user = await createTestUser('exp-linked-act')

    const { data: farm } = await admin
      .from('farms')
      .insert({ owner_id: user.id, name: 'Linked Farm', acreage: 4 })
      .select('id').single()
    if (!farm) throw new Error('farm seed failed')
    farmId = farm.id

    const { data: season } = await admin
      .from('seasons')
      .insert({
        owner_id: user.id,
        year: 2026,
        status: 'active',
        started_at: '2026-01-01',
        contractor_name: 'Linker',
        predetermined_amount: 50_000,
        spray_landlord_pct: 100,
        fertilizer_landlord_pct: 100,
        agreed_boxes: 0,
      })
      .select('id').single()
    if (!season) throw new Error('season seed failed')
    seasonId = season.id

    await admin.from('season_farms').insert({ season_id: seasonId, farm_id: farmId })

    const { data: activity } = await admin
      .from('activities')
      .insert({ season_id: seasonId, farm_id: farmId, type: 'spray', activity_date: '2026-05-01' })
      .select('id').single()
    if (!activity) throw new Error('activity seed failed')
    activityId = activity.id
  })

  afterAll(async () => {
    clearCurrentClient()
    if (user) await deleteTestUser(user.id)
  })

  it('returns linked_activity with id and type for a linked expense', async () => {
    const { data: expense } = await admin
      .from('expenses')
      .insert({
        season_id: seasonId,
        farm_id: farmId,
        category: 'spray',
        amount: 3000,
        landlord_cost: 3000,
        expense_date: '2026-05-01',
        linked_activity_id: activityId,
      })
      .select('id').single()
    if (!expense) throw new Error('expense seed failed')

    setCurrentClient(user.client)
    const { items } = await getExpenses(seasonId)
    const found = items.find((e) => e.id === expense.id)

    expect(found).toBeDefined()
    expect(found!.linked_activity).not.toBeNull()
    expect(found!.linked_activity!.id).toBe(activityId)
    expect(found!.linked_activity!.type).toBe('spray')
  })

  it('returns null linked_activity for an expense with no linked activity', async () => {
    const { data: expense2 } = await admin
      .from('expenses')
      .insert({
        season_id: seasonId,
        farm_id: farmId,
        category: 'labor',
        amount: 1000,
        landlord_cost: 1000,
        expense_date: '2026-05-02',
      })
      .select('id').single()
    if (!expense2) throw new Error('expense2 seed failed')

    setCurrentClient(user.client)
    const { items } = await getExpenses(seasonId)
    const found = items.find((e) => e.id === expense2.id)

    expect(found).toBeDefined()
    expect(found!.linked_activity).toBeNull()
  })
})

/**
 * Phase 10 — createExpense rejects expense_date before season start, and
 * rejects any write against a draft season.
 */
describe('createExpense — season window guard (Phase 10)', () => {
  const admin = createAdminClient()
  let user: TestUser
  let activeSeasonId: string
  let draftSeasonId: string

  beforeAll(async () => {
    await resetDb(admin)
    user = await createTestUser('exp-window')

    const { data: active } = await admin
      .from('seasons')
      .insert({
        owner_id: user.id,
        year: 2026,
        status: 'active',
        started_at: '2026-04-01',
        contractor_name: 'Active C',
        predetermined_amount: 50_000,
        spray_landlord_pct: 50,
        fertilizer_landlord_pct: 50,
        agreed_boxes: 0,
      })
      .select('id').single()
    if (!active) throw new Error('active season seed failed')
    activeSeasonId = active.id

    const { data: draft } = await admin
      .from('seasons')
      .insert({
        owner_id: user.id,
        year: 2027,
        status: 'draft',
        contractor_name: 'Draft C',
        predetermined_amount: 50_000,
        spray_landlord_pct: 50,
        fertilizer_landlord_pct: 50,
        agreed_boxes: 0,
      })
      .select('id').single()
    if (!draft) throw new Error('draft season seed failed')
    draftSeasonId = draft.id
  })

  afterAll(async () => {
    clearCurrentClient()
    if (user) await deleteTestUser(user.id)
  })

  function makeFormData(expenseDate: string) {
    const fd = new FormData()
    fd.set('category', 'misc')
    fd.set('amount', '500')
    fd.set('expense_date', expenseDate)
    fd.set('farm_id', '')
    fd.set('description', 'guard test')
    return fd
  }

  it('rejects expense dated before season started_at', async () => {
    setCurrentClient(user.client)
    const result = await createExpense(makeFormData('2026-03-15'), activeSeasonId)
    expect(result).toHaveProperty('error')
    const err = (result as { error: Record<string, string[]> }).error
    expect(err.expense_date?.[0]).toMatch(/on or after the season start/i)
  })

  it('rejects any expense against a draft season', async () => {
    setCurrentClient(user.client)
    const result = await createExpense(makeFormData('2026-05-01'), draftSeasonId)
    expect(result).toHaveProperty('error')
    const err = (result as { error: Record<string, string[]> }).error
    expect(err.expense_date?.[0]).toMatch(/season is not active/i)
  })

  it('accepts expense dated on or after season started_at', async () => {
    setCurrentClient(user.client)
    const result = await createExpense(makeFormData('2026-05-01'), activeSeasonId)
    expect(result).toMatchObject({ success: true })
  })
})

/**
 * Phase 11B — createExpense rejects a farm_id that is not enrolled in the season,
 * but allows omitting farm_id entirely (it's optional).
 */
describe('createExpense — farm membership guard (Phase 11B)', () => {
  const admin = createAdminClient()
  let user: TestUser
  let seasonId: string
  let enrolledFarmId: string
  let unenrolledFarmId: string

  beforeAll(async () => {
    await resetDb(admin)
    user = await createTestUser('exp-farm-guard')

    // Farm enrolled in the season
    const { data: enrolledFarm } = await admin
      .from('farms')
      .insert({ owner_id: user.id, name: 'Enrolled Farm', acreage: 3 })
      .select('id').single()
    if (!enrolledFarm) throw new Error('enrolledFarm seed failed')
    enrolledFarmId = enrolledFarm.id

    // Farm owned by user but NOT enrolled
    const { data: unenrolledFarm } = await admin
      .from('farms')
      .insert({ owner_id: user.id, name: 'Unenrolled Farm', acreage: 2 })
      .select('id').single()
    if (!unenrolledFarm) throw new Error('unenrolledFarm seed failed')
    unenrolledFarmId = unenrolledFarm.id

    const { data: season } = await admin
      .from('seasons')
      .insert({
        owner_id: user.id,
        year: 2026,
        status: 'active',
        started_at: '2026-01-01',
        contractor_name: 'Guard C',
        predetermined_amount: 50_000,
        spray_landlord_pct: 50,
        fertilizer_landlord_pct: 50,
        agreed_boxes: 0,
      })
      .select('id').single()
    if (!season) throw new Error('season seed failed')
    seasonId = season.id

    // Only enroll the first farm
    await admin.from('season_farms').insert({ season_id: seasonId, farm_id: enrolledFarmId })
  })

  afterAll(async () => {
    clearCurrentClient()
    if (user) await deleteTestUser(user.id)
  })

  it('rejects expense when farm_id is not enrolled in the season', async () => {
    setCurrentClient(user.client)
    const fd = new FormData()
    fd.set('category', 'spray')
    fd.set('amount', '1000')
    fd.set('expense_date', '2026-05-01')
    fd.set('farm_id', unenrolledFarmId)
    fd.set('description', '')

    const result = await createExpense(fd, seasonId)
    expect(result).toHaveProperty('error')
    const err = (result as { error: Record<string, string[]> }).error
    expect(err.farm_id?.[0]).toMatch(/not part of this season/i)
  })

  it('accepts expense when farm_id is omitted (farm is optional)', async () => {
    setCurrentClient(user.client)
    const fd = new FormData()
    fd.set('category', 'labor')
    fd.set('amount', '500')
    fd.set('expense_date', '2026-05-01')
    fd.set('farm_id', '')
    fd.set('description', '')

    const result = await createExpense(fd, seasonId)
    expect(result).toMatchObject({ success: true })
  })
})
