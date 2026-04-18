import { beforeEach, afterAll, describe, expect, it } from 'vitest'
import { createAdminClient, resetDb } from './helpers/admin'
import { createTestUser, deleteTestUser, TestUser } from './helpers/user'
import { setCurrentClient, clearCurrentClient } from './setup'
import { createSeason } from '@/lib/actions/season-actions'

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
