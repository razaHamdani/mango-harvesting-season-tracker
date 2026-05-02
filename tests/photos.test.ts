import { beforeAll, beforeEach, afterAll, describe, expect, it } from 'vitest'
import { createAdminClient, resetDb } from './helpers/admin'
import { createTestUser, deleteTestUser, TestUser } from './helpers/user'
import { setCurrentClient, clearCurrentClient } from './setup'
import { createActivity } from '@/lib/actions/activity-actions'

describe('photo_path — PHOTO-1 namespace validation', () => {
  const admin = createAdminClient()
  let user: TestUser
  let seasonId: string
  let farmId: string

  beforeEach(async () => {
    await resetDb(admin)
    if (user) await deleteTestUser(user.id)
    user = await createTestUser('photo')
    setCurrentClient(user.client)

    const { data: farm } = await user.client
      .from('farms')
      .insert({ owner_id: user.id, name: 'Photo Farm', acreage: 5 })
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
        contractor_name: 'Contractor',
        predetermined_amount: 50_000,
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
      .insert({ season_id: seasonId, farm_id: farmId })
  })

  afterAll(async () => {
    clearCurrentClient()
    if (user) await deleteTestUser(user.id)
  })

  function makeFormData(photoPath: string | null) {
    const fd = new FormData()
    fd.set('farm_id', farmId)
    fd.set('type', 'spray')
    fd.set('activity_date', '2026-05-15')
    fd.set('item_name', '')
    fd.set('description', '')
    if (photoPath) fd.set('photo_path', photoPath)
    return fd
  }

  it('persists a valid user-namespaced photo_path', async () => {
    // File name must be a UUID (enforced by the strict regex validator).
    const fileId = 'c3d4e5f6-a7b8-9012-cdef-123456789012'
    const validPath = `${user.id}/${seasonId}/activities/${fileId}.jpg`
    const result = await createActivity(makeFormData(validPath), seasonId)

    expect(result).toHaveProperty('success', true)
    const activityId = (result as { activityId: string }).activityId

    const { data: row } = await admin
      .from('activities')
      .select('photo_path')
      .eq('id', activityId)
      .single()

    expect(row?.photo_path).toBe(validPath)
  })

  it('nullifies a spoofed path from a different user', async () => {
    const spoofedPath = `other-user-id/${seasonId}/activities/spoofed.jpg`
    const result = await createActivity(makeFormData(spoofedPath), seasonId)

    expect(result).toHaveProperty('success', true)
    const activityId = (result as { activityId: string }).activityId

    const { data: row } = await admin
      .from('activities')
      .select('photo_path')
      .eq('id', activityId)
      .single()

    expect(row?.photo_path).toBeNull()
  })

  it('nullifies a path from a different season', async () => {
    const wrongSeasonPath = `${user.id}/00000000-0000-0000-0000-000000000000/activities/x.jpg`
    const result = await createActivity(makeFormData(wrongSeasonPath), seasonId)

    expect(result).toHaveProperty('success', true)
    const activityId = (result as { activityId: string }).activityId

    const { data: row } = await admin
      .from('activities')
      .select('photo_path')
      .eq('id', activityId)
      .single()

    expect(row?.photo_path).toBeNull()
  })

  it('persists null when no photo_path is submitted', async () => {
    const result = await createActivity(makeFormData(null), seasonId)

    expect(result).toHaveProperty('success', true)
    const activityId = (result as { activityId: string }).activityId

    const { data: row } = await admin
      .from('activities')
      .select('photo_path')
      .eq('id', activityId)
      .single()

    expect(row?.photo_path).toBeNull()
  })
})

/**
 * 5D.6 — Storage bucket RLS: two-segment ownership enforcement.
 *
 * The bucket policy checks BOTH:
 *   1. First path segment = auth.uid()          (user owns the root folder)
 *   2. Second path segment IN (seasons owned by auth.uid())
 *
 * A user must NOT be able to upload into their own uid folder but under a
 * season_id that belongs to a different user.
 *
 * Requires a running Supabase local stack (Docker) with the bucket RLS
 * migration applied. Skips silently if storage is unreachable.
 */
describe('storage bucket — two-segment RLS (5D.6)', () => {
  const admin = createAdminClient()
  let userA: TestUser
  let userBSeasonId: string

  beforeAll(async () => {
    await resetDb(admin)
    userA = await createTestUser('photo-5d6-a')
    const userB = await createTestUser('photo-5d6-b')

    // Season owned by user B
    const { data: season } = await admin
      .from('seasons')
      .insert({
        owner_id: userB.id,
        year: 2026,
        status: 'active',
        started_at: '2026-01-01',
        contractor_name: 'B',
        predetermined_amount: 50_000,
        spray_landlord_pct: 50,
        fertilizer_landlord_pct: 50,
        agreed_boxes: 0,
      })
      .select('id')
      .single()
    if (!season) throw new Error('season insert failed')
    userBSeasonId = season.id

    await deleteTestUser(userB.id)
  })

  afterAll(async () => {
    clearCurrentClient()
    if (userA) await deleteTestUser(userA.id)
  })

  it('rejects direct upload when second path segment is a foreign season', async () => {
    // Path looks correct for user A (first segment = own uid) but the season
    // belongs to user B — the second-segment RLS check must reject this.
    const fileId = 'a0b1c2d3-e4f5-6789-abcd-ef0123456789'
    const path = `${userA.id}/${userBSeasonId}/expenses/${fileId}.jpg`
    const file = new Blob(['fake image'], { type: 'image/jpeg' })

    const { error } = await userA.client.storage
      .from('aam-daata-photos')
      .upload(path, file, { contentType: 'image/jpeg' })

    expect(error).not.toBeNull()
  })
})
