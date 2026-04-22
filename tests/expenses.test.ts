import { beforeEach, beforeAll, afterAll, describe, expect, it } from 'vitest'
import { createAdminClient, resetDb } from './helpers/admin'
import { createTestUser, deleteTestUser, TestUser } from './helpers/user'
import { setCurrentClient, clearCurrentClient } from './setup'
import { createExpense, deleteExpense } from '@/lib/actions/expense-actions'

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
