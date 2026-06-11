/**
 * Phase B4 — closed seasons are immutable.
 *
 * After closeSeason, the insights/net-profit numbers are the financial
 * record of the contract. Creates were already blocked by
 * assertWithinSeasonWindow (requires status='active'), but deletes only
 * checked ownership — an expense or activity could be silently removed
 * from a closed season, altering the record with no trace.
 */
import { beforeAll, afterAll, describe, expect, it } from 'vitest'
import { createAdminClient, resetDb } from './helpers/admin'
import { createTestUser, deleteTestUser, TestUser } from './helpers/user'
import { setCurrentClient, clearCurrentClient } from './setup'
import { deleteExpense } from '@/lib/actions/expense-actions'
import { deleteActivity } from '@/lib/actions/activity-actions'

describe('closed-season immutability (B4)', () => {
  const admin = createAdminClient()
  let user: TestUser
  let seasonId: string
  let expenseId: string
  let activityId: string

  beforeAll(async () => {
    await resetDb(admin)
    user = await createTestUser('closed-immutable')

    const { data: farm } = await admin
      .from('farms')
      .insert({ owner_id: user.id, name: 'Closed Farm', acreage: 4 })
      .select('id').single()
    if (!farm) throw new Error('farm seed failed')

    // Seed as active so child rows can exist, then close.
    const { data: season } = await admin
      .from('seasons')
      .insert({
        owner_id: user.id,
        year: 2026,
        status: 'active',
        started_at: '2026-01-01',
        contractor_name: 'Closed C',
        predetermined_amount: 50_000,
        spray_landlord_pct: 50,
        fertilizer_landlord_pct: 50,
        agreed_boxes: 0,
      })
      .select('id').single()
    if (!season) throw new Error('season seed failed')
    seasonId = season.id

    await admin.from('season_farms').insert({ season_id: seasonId, farm_id: farm.id })

    const { data: expense } = await admin
      .from('expenses')
      .insert({
        season_id: seasonId,
        category: 'misc',
        amount: 1000,
        landlord_cost: 1000,
        expense_date: '2026-02-01',
      })
      .select('id').single()
    if (!expense) throw new Error('expense seed failed')
    expenseId = expense.id

    const { data: activity } = await admin
      .from('activities')
      .insert({
        season_id: seasonId,
        farm_id: farm.id,
        type: 'spray',
        activity_date: '2026-02-01',
        description: 'pre-close spray',
      })
      .select('id').single()
    if (!activity) throw new Error('activity seed failed')
    activityId = activity.id

    const { error: closeErr } = await admin
      .from('seasons')
      .update({ status: 'closed', closed_at: new Date().toISOString() })
      .eq('id', seasonId)
    if (closeErr) throw new Error('season close failed')
  })

  afterAll(async () => {
    clearCurrentClient()
    if (user) await deleteTestUser(user.id)
  })

  it('rejects deleteExpense on a closed season and the row survives', async () => {
    setCurrentClient(user.client)
    const result = await deleteExpense(expenseId, seasonId)

    expect(result).toEqual({ error: 'Records of a closed season cannot be deleted.' })

    const { data: row } = await admin
      .from('expenses')
      .select('id')
      .eq('id', expenseId)
      .maybeSingle()
    expect(row).not.toBeNull()
  })

  it('rejects deleteActivity on a closed season and the row survives', async () => {
    setCurrentClient(user.client)
    const result = await deleteActivity(activityId, seasonId)

    expect(result).toEqual({ error: 'Records of a closed season cannot be deleted.' })

    const { data: row } = await admin
      .from('activities')
      .select('id')
      .eq('id', activityId)
      .maybeSingle()
    expect(row).not.toBeNull()
  })
})
