import { beforeAll, afterAll, describe, expect, it } from 'vitest'
import { createAdminClient, resetDb } from './helpers/admin'
import { createTestUser, deleteTestUser, TestUser } from './helpers/user'
import { setCurrentClient, clearCurrentClient } from './setup'
import { createActivity, deleteActivity } from '@/lib/actions/activity-actions'
import { getActivities } from '@/lib/queries/activity-queries'

/**
 * Phase 1.3 — IDOR in deleteActivity.
 * User B must not be able to delete User A's activity by guessing its UUID.
 */
describe('deleteActivity — IDOR protection', () => {
  const admin = createAdminClient()
  let userA: TestUser
  let userB: TestUser
  let userASeasonId: string
  let userAActivityId: string

  beforeAll(async () => {
    await resetDb(admin)
    userA = await createTestUser('activity-a')
    userB = await createTestUser('activity-b')

    // Seed: farm + season + activity owned by user A
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

    const { data: activity } = await admin
      .from('activities')
      .insert({
        season_id: userASeasonId,
        farm_id: farm.id,
        type: 'spray',
        activity_date: '2026-05-01',
        description: 'First spray',
      })
      .select('id')
      .single()
    if (!activity) throw new Error('activity seed failed')
    userAActivityId = activity.id
  })

  afterAll(async () => {
    clearCurrentClient()
    if (userA) await deleteTestUser(userA.id)
    if (userB) await deleteTestUser(userB.id)
  })

  it('rejects when user B tries to delete user A activity', async () => {
    setCurrentClient(userB.client)
    const result = await deleteActivity(userAActivityId, userASeasonId)

    expect(result).toHaveProperty('error')
    expect(typeof (result as { error: string }).error).toBe('string')

    // Row must still exist
    const { data: row } = await admin
      .from('activities')
      .select('id')
      .eq('id', userAActivityId)
      .single()
    expect(row).not.toBeNull()
  })

  it('allows the legitimate owner to delete their own activity', async () => {
    setCurrentClient(userA.client)
    const result = await deleteActivity(userAActivityId, userASeasonId)

    expect(result).toMatchObject({ success: true })

    // Row must be gone
    const { data: row } = await admin
      .from('activities')
      .select('id')
      .eq('id', userAActivityId)
      .maybeSingle()
    expect(row).toBeNull()
  })
})

describe('getActivities — ownership guard', () => {
  const admin = createAdminClient()
  let userA: TestUser
  let userB: TestUser
  let userASeasonId: string

  beforeAll(async () => {
    await resetDb(admin)
    userA = await createTestUser('get-activity-a')
    userB = await createTestUser('get-activity-b')

    // Seed: farm + season + activity owned by user A
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
      .from('activities')
      .insert({
        season_id: userASeasonId,
        farm_id: farm.id,
        type: 'spray',
        activity_date: '2026-05-01',
        description: 'First spray',
      })
  })

  afterAll(async () => {
    clearCurrentClient()
    if (userA) await deleteTestUser(userA.id)
    if (userB) await deleteTestUser(userB.id)
  })

  it('returns empty page when user B requests user A season activities', async () => {
    setCurrentClient(userB.client)
    const result = await getActivities(userASeasonId)

    expect(result).toEqual({ items: [], nextCursor: null })
  })
})

describe('getActivities — linked expenses', () => {
  const admin = createAdminClient()
  let user: TestUser
  let seasonId: string
  let farmId: string
  let activityId: string
  let expenseId: string

  beforeAll(async () => {
    user = await createTestUser('act-linked-exp')

    const { data: farm } = await admin
      .from('farms')
      .insert({ owner_id: user.id, name: 'Link Farm', acreage: 3 })
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

    await admin.from('season_farms').insert({ season_id: seasonId, farm_id: farm.id })

    const { data: activity } = await admin
      .from('activities')
      .insert({ season_id: seasonId, farm_id: farm.id, type: 'spray', activity_date: '2026-05-01' })
      .select('id').single()
    if (!activity) throw new Error('activity seed failed')
    activityId = activity.id

    const { data: expense } = await admin
      .from('expenses')
      .insert({
        season_id: seasonId,
        farm_id: farm.id,
        category: 'spray',
        amount: 5000,
        landlord_cost: 5000,
        expense_date: '2026-05-01',
        linked_activity_id: activityId,
      })
      .select('id').single()
    if (!expense) throw new Error('expense seed failed')
    expenseId = expense.id
  })

  afterAll(async () => {
    clearCurrentClient()
    if (user) await deleteTestUser(user.id)
  })

  it('returns linked_expenses array with the linked expense', async () => {
    setCurrentClient(user.client)
    const { items } = await getActivities(seasonId)
    const activity = items.find((a) => a.id === activityId)

    expect(activity).toBeDefined()
    expect(activity!.linked_expenses).toHaveLength(1)
    expect(activity!.linked_expenses[0].id).toBe(expenseId)
    expect(activity!.linked_expenses[0].category).toBe('spray')
    expect(activity!.linked_expenses[0].amount).toBe(5000)
  })

  it('returns empty linked_expenses for activity with no linked expenses', async () => {
    const { data: activity2 } = await admin
      .from('activities')
      .insert({ season_id: seasonId, farm_id: farmId, type: 'water', activity_date: '2026-05-02' })
      .select('id').single()
    if (!activity2) throw new Error('activity2 seed failed')

    setCurrentClient(user.client)
    const { items } = await getActivities(seasonId)
    const found = items.find((a) => a.id === activity2.id)

    expect(found).toBeDefined()
    expect(found!.linked_expenses).toHaveLength(0)
  })
})

/**
 * Phase 10 — createActivity rejects activity_date before season start, and
 * rejects any write against a draft (not-yet-active) season.
 */
describe('createActivity — season window guard (Phase 10)', () => {
  const admin = createAdminClient()
  let user: TestUser
  let farmId: string
  let activeSeasonId: string
  let draftSeasonId: string

  beforeAll(async () => {
    await resetDb(admin)
    user = await createTestUser('act-window')

    const { data: farm } = await admin
      .from('farms')
      .insert({ owner_id: user.id, name: 'Window Farm', acreage: 4 })
      .select('id').single()
    if (!farm) throw new Error('farm seed failed')
    farmId = farm.id

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
    await admin.from('season_farms').insert({ season_id: activeSeasonId, farm_id: farmId })

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
    await admin.from('season_farms').insert({ season_id: draftSeasonId, farm_id: farmId })
  })

  afterAll(async () => {
    clearCurrentClient()
    if (user) await deleteTestUser(user.id)
  })

  function makeFormData(activityDate: string) {
    const fd = new FormData()
    fd.set('farm_id', farmId)
    fd.set('type', 'spray')
    fd.set('activity_date', activityDate)
    fd.set('item_name', '')
    fd.set('description', '')
    return fd
  }

  it('rejects activity dated before season started_at', async () => {
    setCurrentClient(user.client)
    const result = await createActivity(makeFormData('2026-03-15'), activeSeasonId)
    expect(result).toHaveProperty('error')
    const err = (result as { error: Record<string, string[]> }).error
    expect(err.activity_date?.[0]).toMatch(/on or after the season start/i)
  })

  it('rejects any activity against a draft season', async () => {
    setCurrentClient(user.client)
    const result = await createActivity(makeFormData('2026-05-01'), draftSeasonId)
    expect(result).toHaveProperty('error')
    const err = (result as { error: Record<string, string[]> }).error
    expect(err.activity_date?.[0]).toMatch(/season is not active/i)
  })

  it('accepts activity dated on or after season started_at', async () => {
    setCurrentClient(user.client)
    const result = await createActivity(makeFormData('2026-05-01'), activeSeasonId)
    expect(result).toMatchObject({ success: true })
  })
})

/**
 * Phase 11B — createActivity rejects a farm_id that is not enrolled in the season.
 */
describe('createActivity — farm membership guard (Phase 11B)', () => {
  const admin = createAdminClient()
  let user: TestUser
  let seasonId: string
  let enrolledFarmId: string
  let unenrolledFarmId: string

  beforeAll(async () => {
    await resetDb(admin)
    user = await createTestUser('act-farm-guard')

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

  function makeFormData(farmId: string) {
    const fd = new FormData()
    fd.set('farm_id', farmId)
    fd.set('type', 'spray')
    fd.set('activity_date', '2026-05-01')
    fd.set('item_name', '')
    fd.set('description', '')
    return fd
  }

  it('rejects activity when farm_id is not enrolled in the season', async () => {
    setCurrentClient(user.client)
    const result = await createActivity(makeFormData(unenrolledFarmId), seasonId)
    expect(result).toHaveProperty('error')
    const err = (result as { error: Record<string, string[]> }).error
    expect(err.farm_id?.[0]).toMatch(/not part of this season/i)
  })

  it('accepts activity when farm_id is enrolled in the season', async () => {
    setCurrentClient(user.client)
    const result = await createActivity(makeFormData(enrolledFarmId), seasonId)
    expect(result).toMatchObject({ success: true })
  })
})
