import { beforeAll, afterAll, describe, expect, it } from 'vitest'
import { createAdminClient, resetDb } from './helpers/admin'
import { createTestUser, deleteTestUser, TestUser } from './helpers/user'
import { clearCurrentClient } from './setup'

/**
 * Phase 1.1 — get_season_insights RPC must reject callers who do not
 * own the season. Today the function is SECURITY DEFINER with no
 * auth.uid() check, which leaks any user's full financial picture
 * (predetermined amount, expenses, payments) to anyone who knows the
 * season UUID. The fix adds an IF NOT EXISTS ownership guard.
 */
describe('get_season_insights — ownership guard', () => {
  const admin = createAdminClient()
  let userA: TestUser
  let userB: TestUser
  let userASeasonId: string

  beforeAll(async () => {
    await resetDb(admin)
    userA = await createTestUser('insights-a')
    userB = await createTestUser('insights-b')

    // Seed: farm + season owned by user A (admin insert bypasses RLS).
    const { data: farm } = await admin
      .from('farms')
      .insert({ owner_id: userA.id, name: 'A Farm', acreage: 10 })
      .select('id')
      .single()
    if (!farm) throw new Error('farm seed failed')

    const { data: season, error: seasonErr } = await admin
      .from('seasons')
      .insert({
        owner_id: userA.id,
        year: 2026,
        status: 'draft',
        contractor_name: 'A Contractor',
        predetermined_amount: 100_000,
        spray_landlord_pct: 50,
        fertilizer_landlord_pct: 50,
        agreed_boxes: 0,
      })
      .select('id')
      .single()
    if (seasonErr || !season) {
      throw new Error(`season seed failed: ${seasonErr?.message}`)
    }
    userASeasonId = season.id

    await admin
      .from('season_farms')
      .insert({ season_id: userASeasonId, farm_id: farm.id })
  })

  afterAll(async () => {
    if (userA) await deleteTestUser(userA.id)
    if (userB) await deleteTestUser(userB.id)
  })

  it('rejects non-owner calling RPC with foreign season UUID', async () => {
    const { data, error } = await userB.client.rpc('get_season_insights', {
      p_season_id: userASeasonId,
    })

    expect(error).not.toBeNull()
    // Postgres SQLSTATE 42501 = insufficient_privilege
    expect(error?.code).toBe('42501')
    expect(data).toBeNull()
  })

  it('allows the legitimate owner to read insights', async () => {
    const { data, error } = await userA.client.rpc('get_season_insights', {
      p_season_id: userASeasonId,
    })

    expect(error).toBeNull()
    expect(data).toBeDefined()
    // Shape check — aggregate fields should be present
    const obj = data as Record<string, unknown>
    expect(obj).toHaveProperty('predetermined_amount')
    expect(Number(obj.predetermined_amount)).toBe(100_000)
    expect(obj).toHaveProperty('total_expenses')
    expect(obj).toHaveProperty('installments_total')
  })
})

describe('get_season_insights — labor category folds in salaries + casual labor', () => {
  const admin = createAdminClient()
  let user: TestUser
  let seasonId: string

  beforeAll(async () => {
    await resetDb(admin)
    user = await createTestUser('insights-worker-12')

    const { data: season } = await admin
      .from('seasons')
      .insert({
        owner_id: user.id,
        year: 2026,
        status: 'active',
        started_at: '2026-01-01',
        contractor_name: 'Salary Insights C',
        predetermined_amount: 100_000,
        spray_landlord_pct: 50,
        fertilizer_landlord_pct: 100,
        agreed_boxes: 0,
      })
      .select('id')
      .single()
    if (!season) throw new Error('season seed failed')
    seasonId = season.id

    const { data: worker } = await admin
      .from('workers')
      .insert({
        owner_id: user.id,
        name: 'Insights Worker',
        monthly_salary: 20_000,
      })
      .select('id')
      .single()
    if (!worker) throw new Error('worker seed failed')

    // Expense A: salary labor expense linked to worker
    await admin
      .from('expenses')
      .insert({
        season_id: seasonId,
        farm_id: null,
        category: 'labor',
        amount: 20000,
        landlord_cost: 20000,
        expense_date: '2026-05-01',
        worker_id: worker.id,
      })

    // Expense B: casual labor expense (no worker)
    await admin
      .from('expenses')
      .insert({
        season_id: seasonId,
        farm_id: null,
        category: 'labor',
        amount: 5000,
        landlord_cost: 5000,
        expense_date: '2026-05-02',
        worker_id: null,
      })
  })

  afterAll(async () => {
    clearCurrentClient()
    if (user) await deleteTestUser(user.id)
  })

  it('labor category total includes both salaried and casual labor; worker_salaries removed', async () => {
    const { data, error } = await user.client.rpc('get_season_insights', {
      p_season_id: seasonId,
    })

    expect(error).toBeNull()
    expect(data).toBeDefined()
    const obj = data as Record<string, unknown>
    // worker_salaries is no longer part of the contract.
    expect(obj.worker_salaries).toBeUndefined()
    // Labor category now folds in the salaried (20000) + casual (5000) expenses.
    const byCat = obj.expenses_by_category as Record<string, number>
    expect(Number(byCat.labor)).toBe(25000)
    expect(Number(obj.total_expenses)).toBe(25000)
  })
})
