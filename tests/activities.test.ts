import { beforeAll, afterAll, describe, expect, it } from 'vitest'
import { createAdminClient, resetDb } from './helpers/admin'
import { createTestUser, deleteTestUser, TestUser } from './helpers/user'
import { setCurrentClient, clearCurrentClient } from './setup'
import { deleteActivity } from '@/lib/actions/activity-actions'
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
