import { beforeAll, beforeEach, afterAll, describe, expect, it } from 'vitest'
import { createAdminClient, resetDb } from './helpers/admin'
import { createTestUser, deleteTestUser, TestUser } from './helpers/user'
import { setCurrentClient, clearCurrentClient } from './setup'
import { createSeason, closeSeason, deleteSeason } from '@/lib/actions/season-actions'
import { createActivity } from '@/lib/actions/activity-actions'
import { createExpense } from '@/lib/actions/expense-actions'
import { recordPayment } from '@/lib/actions/payment-actions'

/**
 * Season date range — seasons carry a user-chosen start_date / end_date.
 * - One owner can have several seasons in a year, but their ranges cannot
 *   overlap (EXCLUDE seasons_no_overlap).
 * - Child records must fall inside the range: the app guard rejects them
 *   with a friendly message, the DB trigger enforce_season_date_range is the
 *   backstop for direct writes.
 * - Draft and closed seasons can be deleted; active ones cannot.
 */

const SEASON_TERMS = {
  contractor_name: 'Range Contractor',
  predetermined_amount: 100_000,
  spray_landlord_pct: 50,
  fertilizer_landlord_pct: 50,
  agreed_boxes: 0,
}

describe('createSeason — several non-overlapping seasons per year', () => {
  const admin = createAdminClient()
  let user: TestUser
  let farmId: string

  beforeEach(async () => {
    await resetDb(admin)
    if (user) await deleteTestUser(user.id)
    user = await createTestUser('range-create')
    setCurrentClient(user.client)

    const { data: farm } = await user.client
      .from('farms')
      .insert({ owner_id: user.id, name: 'Range Farm', acreage: 10 })
      .select('id')
      .single()
    if (!farm) throw new Error('farm insert failed')
    farmId = farm.id
  })

  afterAll(async () => {
    clearCurrentClient()
    if (user) await deleteTestUser(user.id)
  })

  it('creates two seasons in the same year (Jan–May and Aug–Dec)', async () => {
    const spring = await createSeason({
      ...SEASON_TERMS,
      start_date: '2026-01-01',
      end_date: '2026-05-31',
      farm_ids: [farmId],
      installments: [
        { amount: 50_000, due_date: '2026-02-01' },
        { amount: 50_000, due_date: '2026-05-01' },
      ],
    })
    expect(spring).toHaveProperty('id')

    const autumn = await createSeason({
      ...SEASON_TERMS,
      start_date: '2026-08-01',
      end_date: '2026-12-31',
      farm_ids: [farmId],
      installments: [
        { amount: 50_000, due_date: '2026-09-01' },
        { amount: 50_000, due_date: '2026-12-01' },
      ],
    })
    expect(autumn).toHaveProperty('id')

    const { data: rows } = await admin
      .from('seasons')
      .select('year, start_date, end_date, status')
      .eq('owner_id', user.id)
      .order('start_date')
    expect(rows).toEqual([
      { year: 2026, start_date: '2026-01-01', end_date: '2026-05-31', status: 'draft' },
      { year: 2026, start_date: '2026-08-01', end_date: '2026-12-31', status: 'draft' },
    ])
  })

  it('rejects a range overlapping an existing season and inserts nothing', async () => {
    const first = await createSeason({
      ...SEASON_TERMS,
      start_date: '2026-01-01',
      end_date: '2026-05-31',
      farm_ids: [farmId],
      installments: [{ amount: 100_000, due_date: '2026-03-01' }],
    })
    expect(first).toHaveProperty('id')

    // Overlaps on the inclusive boundary day 2026-05-31.
    const overlapping = await createSeason({
      ...SEASON_TERMS,
      start_date: '2026-05-31',
      end_date: '2026-09-30',
      farm_ids: [farmId],
      installments: [{ amount: 100_000, due_date: '2026-07-01' }],
    })
    expect(overlapping).toEqual({
      error: { _form: ['These dates overlap another of your seasons.'] },
    })

    const [seasons, installments] = await Promise.all([
      admin.from('seasons').select('id').eq('owner_id', user.id),
      admin.from('installments').select('id'),
    ])
    expect(seasons.data).toHaveLength(1)
    expect(installments.data).toHaveLength(1)
  })

  it('does not treat another user\'s season in the same range as an overlap', async () => {
    const other = await createTestUser('range-create-other')
    try {
      await admin.from('seasons').insert({
        owner_id: other.id,
        year: 2026,
        start_date: '2026-01-01',
        end_date: '2026-12-31',
        status: 'draft',
        ...SEASON_TERMS,
      })

      const result = await createSeason({
        ...SEASON_TERMS,
        start_date: '2026-03-01',
        end_date: '2026-06-30',
        farm_ids: [farmId],
        installments: [{ amount: 100_000, due_date: '2026-04-01' }],
      })
      expect(result).toHaveProperty('id')
    } finally {
      await deleteTestUser(other.id)
    }
  })
})

/**
 * App guard — child records dated outside [start_date, end_date] are rejected
 * by assertWithinSeasonWindow before any insert. The season lies entirely in
 * the past so "after end_date" is not also "in the future".
 */
describe('season date guard — activities, expenses, payments', () => {
  const admin = createAdminClient()
  let user: TestUser
  let seasonId: string
  let farmId: string
  let installmentId: string

  beforeAll(async () => {
    await resetDb(admin)
    user = await createTestUser('range-guard')

    const { data: farm } = await admin
      .from('farms')
      .insert({ owner_id: user.id, name: 'Guard Farm', acreage: 4 })
      .select('id').single()
    if (!farm) throw new Error('farm seed failed')
    farmId = farm.id

    const { data: season } = await admin
      .from('seasons')
      .insert({
        owner_id: user.id,
        year: 2026,
        start_date: '2026-03-01',
        end_date: '2026-06-30',
        status: 'active',
        ...SEASON_TERMS,
      })
      .select('id').single()
    if (!season) throw new Error('season seed failed')
    seasonId = season.id
    await admin.from('season_farms').insert({ season_id: seasonId, farm_id: farmId })

    const { data: inst } = await admin
      .from('installments')
      .insert({
        season_id: seasonId,
        installment_number: 1,
        expected_amount: 100_000,
        due_date: '2026-04-01',
      })
      .select('id').single()
    if (!inst) throw new Error('installment seed failed')
    installmentId = inst.id
  })

  afterAll(async () => {
    clearCurrentClient()
    if (user) await deleteTestUser(user.id)
  })

  function activityForm(date: string) {
    const fd = new FormData()
    fd.set('farm_id', farmId)
    fd.set('type', 'spray')
    fd.set('activity_date', date)
    fd.set('item_name', '')
    fd.set('description', '')
    return fd
  }

  function expenseForm(date: string) {
    const fd = new FormData()
    fd.set('category', 'misc')
    fd.set('amount', '500')
    fd.set('expense_date', date)
    fd.set('farm_id', '')
    fd.set('description', 'range guard')
    return fd
  }

  function paymentForm(date: string) {
    const fd = new FormData()
    fd.set('amount', '100000')
    fd.set('paid_date', date)
    return fd
  }

  async function childCounts() {
    const [a, e] = await Promise.all([
      admin.from('activities').select('id', { count: 'exact', head: true }).eq('season_id', seasonId),
      admin.from('expenses').select('id', { count: 'exact', head: true }).eq('season_id', seasonId),
    ])
    return { activities: a.count, expenses: e.count }
  }

  it('rejects an activity dated after end_date', async () => {
    setCurrentClient(user.client)
    const result = await createActivity(activityForm('2026-07-01'), seasonId)
    const err = (result as { error: Record<string, string[]> }).error
    expect(err.activity_date?.[0]).toBe('Date must be on or before the season end (2026-06-30).')
    expect((await childCounts()).activities).toBe(0)
  })

  it('rejects an activity dated before start_date', async () => {
    setCurrentClient(user.client)
    const result = await createActivity(activityForm('2026-02-28'), seasonId)
    const err = (result as { error: Record<string, string[]> }).error
    expect(err.activity_date?.[0]).toBe('Date must be on or after the season start (2026-03-01).')
    expect((await childCounts()).activities).toBe(0)
  })

  it('rejects an expense dated after end_date', async () => {
    setCurrentClient(user.client)
    const result = await createExpense(expenseForm('2026-07-01'), seasonId)
    const err = (result as { error: Record<string, string[]> }).error
    expect(err.expense_date?.[0]).toBe('Date must be on or before the season end (2026-06-30).')
    expect((await childCounts()).expenses).toBe(0)
  })

  it('rejects an expense dated before start_date', async () => {
    setCurrentClient(user.client)
    const result = await createExpense(expenseForm('2026-02-28'), seasonId)
    const err = (result as { error: Record<string, string[]> }).error
    expect(err.expense_date?.[0]).toBe('Date must be on or after the season start (2026-03-01).')
    expect((await childCounts()).expenses).toBe(0)
  })

  it('rejects a payment dated after end_date', async () => {
    setCurrentClient(user.client)
    const result = await recordPayment(installmentId, paymentForm('2026-07-01'), seasonId)
    expect(result).toEqual({ error: 'Date must be on or before the season end (2026-06-30).' })
  })

  it('rejects a payment dated before start_date', async () => {
    setCurrentClient(user.client)
    const result = await recordPayment(installmentId, paymentForm('2026-02-28'), seasonId)
    expect(result).toEqual({ error: 'Date must be on or after the season start (2026-03-01).' })

    const { data: row } = await admin
      .from('installments')
      .select('paid_amount, paid_date')
      .eq('id', installmentId)
      .single()
    expect(row?.paid_amount).toBeNull()
    expect(row?.paid_date).toBeNull()
  })

  it('accepts records on the inclusive bounds', async () => {
    setCurrentClient(user.client)
    expect(await createActivity(activityForm('2026-03-01'), seasonId)).toMatchObject({ success: true })
    expect(await createExpense(expenseForm('2026-06-30'), seasonId)).toMatchObject({ success: true })
  })
})

/**
 * DB backstop — enforce_season_date_range rejects out-of-range child rows
 * even for a direct (service-role) insert that skips the app guard.
 */
describe('enforce_season_date_range trigger', () => {
  const admin = createAdminClient()
  let user: TestUser
  let seasonId: string
  let farmId: string

  beforeAll(async () => {
    await resetDb(admin)
    user = await createTestUser('range-trigger')

    const { data: farm } = await admin
      .from('farms')
      .insert({ owner_id: user.id, name: 'Trigger Farm', acreage: 4 })
      .select('id').single()
    if (!farm) throw new Error('farm seed failed')
    farmId = farm.id

    const { data: season } = await admin
      .from('seasons')
      .insert({
        owner_id: user.id,
        year: 2026,
        start_date: '2026-03-01',
        end_date: '2026-06-30',
        status: 'active',
        ...SEASON_TERMS,
      })
      .select('id').single()
    if (!season) throw new Error('season seed failed')
    seasonId = season.id
  })

  afterAll(async () => {
    if (user) await deleteTestUser(user.id)
  })

  it('rejects a direct admin insert of an activity dated after end_date', async () => {
    const { data, error } = await admin
      .from('activities')
      .insert({ season_id: seasonId, farm_id: farmId, type: 'spray', activity_date: '2026-07-01' })
      .select('id')
    expect(data).toBeNull()
    expect(error?.code).toBe('23514')
    expect(error?.message).toMatch(/outside season date range/)

    const { count } = await admin
      .from('activities')
      .select('id', { count: 'exact', head: true })
      .eq('season_id', seasonId)
    expect(count).toBe(0)
  })

  it('rejects a direct admin insert of an installment due before start_date', async () => {
    const { error } = await admin.from('installments').insert({
      season_id: seasonId,
      installment_number: 1,
      expected_amount: 1_000,
      due_date: '2026-02-28',
    })
    expect(error?.code).toBe('23514')
    expect(error?.message).toMatch(/outside season date range/)
  })

  it('allows a direct admin insert dated inside the range', async () => {
    const { error } = await admin
      .from('activities')
      .insert({ season_id: seasonId, farm_id: farmId, type: 'spray', activity_date: '2026-06-30' })
    expect(error).toBeNull()
  })
})

/**
 * deleteSeason — draft and closed seasons can be deleted (closed ones with
 * all their children, via ON DELETE CASCADE); an active season cannot.
 */
describe('deleteSeason — lifecycle rules', () => {
  const admin = createAdminClient()
  let user: TestUser
  let farmId: string

  async function seedSeason(status: 'draft' | 'active') {
    const { data: s } = await admin
      .from('seasons')
      .insert({
        owner_id: user.id,
        year: 2026,
        start_date: '2026-01-01',
        end_date: '2026-06-30',
        status,
        ...SEASON_TERMS,
      })
      .select('id')
      .single()
    if (!s) throw new Error('season seed failed')
    await admin.from('season_farms').insert({ season_id: s.id, farm_id: farmId })
    return s.id as string
  }

  async function seedChildren(seasonId: string) {
    const { error: aErr } = await admin.from('activities').insert({
      season_id: seasonId, farm_id: farmId, type: 'spray', activity_date: '2026-02-01',
    })
    const { error: eErr } = await admin.from('expenses').insert({
      season_id: seasonId, category: 'misc', amount: 1000, landlord_cost: 1000,
      expense_date: '2026-02-01',
    })
    const { error: iErr } = await admin.from('installments').insert({
      season_id: seasonId, installment_number: 1, expected_amount: 100_000,
      due_date: '2026-03-01', paid_amount: 100_000, paid_date: '2026-03-01',
    })
    if (aErr || eErr || iErr) {
      throw new Error(`child seed failed: ${aErr?.message ?? eErr?.message ?? iErr?.message}`)
    }
  }

  async function countRows(seasonId: string) {
    const tables = ['seasons', 'season_farms', 'activities', 'expenses', 'installments'] as const
    const counts = await Promise.all(
      tables.map((t) =>
        admin
          .from(t)
          .select('*', { count: 'exact', head: true })
          .eq(t === 'seasons' ? 'id' : 'season_id', seasonId),
      ),
    )
    return Object.fromEntries(tables.map((t, i) => [t, counts[i].count]))
  }

  beforeEach(async () => {
    await resetDb(admin)
    if (user) await deleteTestUser(user.id)
    user = await createTestUser('range-delete')
    setCurrentClient(user.client)

    const { data: farm } = await admin
      .from('farms')
      .insert({ owner_id: user.id, name: 'Delete Farm', acreage: 4 })
      .select('id').single()
    if (!farm) throw new Error('farm seed failed')
    farmId = farm.id
  })

  afterAll(async () => {
    clearCurrentClient()
    if (user) await deleteTestUser(user.id)
  })

  it('rejects deleting an active season and the season and its children survive', async () => {
    const seasonId = await seedSeason('active')
    await seedChildren(seasonId)

    const result = await deleteSeason(seasonId)
    expect(result).toEqual({
      error: { _form: ['An active season cannot be deleted. Close it first.'] },
    })

    expect(await countRows(seasonId)).toEqual({
      seasons: 1, season_farms: 1, activities: 1, expenses: 1, installments: 1,
    })
  })

  it('deletes a closed season together with its children', async () => {
    const seasonId = await seedSeason('active')
    await seedChildren(seasonId)
    expect(await closeSeason(seasonId)).toMatchObject({ success: true })

    const result = await deleteSeason(seasonId)
    expect(result).toEqual({ success: true })

    expect(await countRows(seasonId)).toEqual({
      seasons: 0, season_farms: 0, activities: 0, expenses: 0, installments: 0,
    })
  })

  it('deletes a draft season', async () => {
    const seasonId = await seedSeason('draft')

    const result = await deleteSeason(seasonId)
    expect(result).toEqual({ success: true })

    expect((await countRows(seasonId)).seasons).toBe(0)
  })
})
