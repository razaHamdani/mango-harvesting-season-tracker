import { beforeEach, afterAll, describe, expect, it } from 'vitest'
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
