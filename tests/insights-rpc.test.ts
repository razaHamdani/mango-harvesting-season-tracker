import { beforeAll, afterAll, describe, expect, it } from 'vitest'
import { createAdminClient, resetDb } from './helpers/admin'
import { createTestUser, deleteTestUser, TestUser } from './helpers/user'

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
