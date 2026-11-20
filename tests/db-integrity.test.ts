/**
 * P3 — data-integrity rules enforced by Postgres, not only by the app.
 *
 * - 20261120120000_closed_season_frozen.sql: a closed season's children and
 *   its own row cannot change (SQLSTATE 55000); deleting the whole season
 *   still cascades.
 * - 20261120120100_owner_bound_references.sql: season_farms.farm_id and
 *   expenses.worker_id must belong to the caller (restrictive RLS).
 * - 20261120120200_profile_role_lockdown.sql: nobody can make themselves
 *   admin.
 *
 * Most cases go through a signed-in user's own Supabase client, i.e. the
 * same REST API an attacker with a session token could call directly.
 *
 * Fixture rule: the closed-season trigger fires for service_role too, so
 * children are seeded while a season is active and the season is closed
 * afterwards.
 */
import { beforeAll, afterAll, describe, expect, it } from 'vitest'
import { Client } from 'pg'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient, resetDb } from './helpers/admin'
import { createTestUser, deleteTestUser, TestUser } from './helpers/user'
import { SUPABASE_DB_URL } from './helpers/env'
import { setCurrentClient, clearCurrentClient } from './setup'
import { deleteWorker } from '@/lib/actions/worker-actions'

const TERMS = {
  contractor_name: 'Integrity C',
  predetermined_amount: 50_000,
  spray_landlord_pct: 50,
  fertilizer_landlord_pct: 50,
  agreed_boxes: 0,
}

async function one<T>(
  p: PromiseLike<{ data: T | null; error: { message: string } | null }>,
  what: string
): Promise<T> {
  const { data, error } = await p
  if (error || !data) throw new Error(`${what} failed: ${error?.message}`)
  return data
}

async function seedFarm(admin: SupabaseClient, ownerId: string, name: string) {
  return one<{ id: string }>(
    admin.from('farms').insert({ owner_id: ownerId, name, acreage: 4 }).select('id').single(),
    `farm ${name}`
  )
}

async function seedSeason(
  admin: SupabaseClient,
  ownerId: string,
  year: number
) {
  return one<{ id: string }>(
    admin
      .from('seasons')
      .insert({
        owner_id: ownerId,
        year,
        status: 'active',
        start_date: `${year}-01-01`,
        end_date: `${year}-12-31`,
        ...TERMS,
      })
      .select('id')
      .single(),
    `season ${year}`
  )
}

async function closeSeason(admin: SupabaseClient, seasonId: string) {
  const { error } = await admin
    .from('seasons')
    .update({ status: 'closed', closed_at: new Date().toISOString() })
    .eq('id', seasonId)
  if (error) throw new Error(`close failed: ${error.message}`)
}

function expense(seasonId: string, year: number, extra: Record<string, unknown> = {}) {
  return {
    season_id: seasonId,
    category: 'misc',
    amount: 1000,
    landlord_cost: 1000,
    expense_date: `${year}-02-01`,
    ...extra,
  }
}

async function pgConnect(): Promise<Client> {
  const c = new Client({ connectionString: SUPABASE_DB_URL })
  await c.connect()
  return c
}

/** Resolves to 'pending' if `p` has not settled within `ms`. */
async function stillPending(p: Promise<unknown>, ms = 500): Promise<boolean> {
  const marker = Symbol('pending')
  const r = await Promise.race([
    p.then(() => 'settled', () => 'settled'),
    new Promise((res) => setTimeout(() => res(marker), ms)),
  ])
  return r === marker
}

describe('closed season is frozen in the database', () => {
  const admin = createAdminClient()
  let user: TestUser
  let farmId: string
  let spareFarmId: string
  let closedId: string
  let activeId: string
  let closedExpenseId: string
  let closedActivityId: string
  let closedInstallmentId: string
  let closedLinkId: string
  let activeExpenseId: string
  let workerId: string

  beforeAll(async () => {
    await resetDb(admin)
    user = await createTestUser('frozen')
    farmId = (await seedFarm(admin, user.id, 'Frozen Farm')).id
    spareFarmId = (await seedFarm(admin, user.id, 'Spare Farm')).id

    // One active season per owner: seed and close 2025 before 2026 exists.
    closedId = (await seedSeason(admin, user.id, 2025)).id

    closedLinkId = (
      await one<{ id: string }>(
        admin.from('season_farms').insert({ season_id: closedId, farm_id: farmId }).select('id').single(),
        'closed link'
      )
    ).id

    workerId = (
      await one<{ id: string }>(
        admin.from('workers').insert({ owner_id: user.id, name: 'Salaried W' }).select('id').single(),
        'worker'
      )
    ).id

    closedExpenseId = (
      await one<{ id: string }>(admin.from('expenses').insert(expense(closedId, 2025)).select('id').single(), 'closed expense')
    ).id
    await one(
      admin
        .from('expenses')
        .insert(expense(closedId, 2025, { category: 'labor', worker_id: workerId }))
        .select('id')
        .single(),
      'closed salary'
    )
    closedActivityId = (
      await one<{ id: string }>(
        admin
          .from('activities')
          .insert({ season_id: closedId, farm_id: farmId, type: 'spray', activity_date: '2025-02-01' })
          .select('id')
          .single(),
        'closed activity'
      )
    ).id
    closedInstallmentId = (
      await one<{ id: string }>(
        admin
          .from('installments')
          .insert({ season_id: closedId, installment_number: 1, expected_amount: 1000, due_date: '2025-03-01' })
          .select('id')
          .single(),
        'closed installment'
      )
    ).id
    await closeSeason(admin, closedId)

    activeId = (await seedSeason(admin, user.id, 2026)).id
    await one(
      admin.from('season_farms').insert({ season_id: activeId, farm_id: farmId }).select('id').single(),
      'active link'
    )
    activeExpenseId = (
      await one<{ id: string }>(admin.from('expenses').insert(expense(activeId, 2026)).select('id').single(), 'active expense')
    ).id
  })

  afterAll(async () => {
    clearCurrentClient()
    if (user) await deleteTestUser(user.id)
  })

  async function expenseRow(id: string) {
    const { data } = await admin.from('expenses').select('season_id, amount').eq('id', id).maybeSingle()
    return data
  }

  it('refuses INSERT, UPDATE and DELETE on activities', async () => {
    const c = user.client
    const ins = await c
      .from('activities')
      .insert({ season_id: closedId, farm_id: farmId, type: 'water', activity_date: '2025-03-01' })
    expect(ins.error?.code).toBe('55000')

    const upd = await c.from('activities').update({ description: 'edited' }).eq('id', closedActivityId)
    expect(upd.error?.code).toBe('55000')

    const del = await c.from('activities').delete().eq('id', closedActivityId)
    expect(del.error?.code).toBe('55000')

    const { data } = await admin.from('activities').select('description').eq('id', closedActivityId).single()
    expect(data?.description).toBeNull()
  })

  it('refuses INSERT, UPDATE and DELETE on expenses', async () => {
    const c = user.client
    expect((await c.from('expenses').insert(expense(closedId, 2025))).error?.code).toBe('55000')
    expect((await c.from('expenses').update({ amount: 1, landlord_cost: 1 }).eq('id', closedExpenseId)).error?.code).toBe('55000')
    expect((await c.from('expenses').delete().eq('id', closedExpenseId)).error?.code).toBe('55000')
    expect(await expenseRow(closedExpenseId)).toEqual({ season_id: closedId, amount: 1000 })
  })

  it('refuses INSERT, UPDATE and DELETE on installments, including recording a payment', async () => {
    const c = user.client
    const ins = await c
      .from('installments')
      .insert({ season_id: closedId, installment_number: 2, expected_amount: 500, due_date: '2025-04-01' })
    expect(ins.error?.code).toBe('55000')

    const pay = await c
      .from('installments')
      .update({ paid_amount: 1000, paid_date: '2025-03-01' })
      .eq('id', closedInstallmentId)
    expect(pay.error?.code).toBe('55000')

    expect((await c.from('installments').delete().eq('id', closedInstallmentId)).error?.code).toBe('55000')

    const { data } = await admin.from('installments').select('paid_amount').eq('id', closedInstallmentId).single()
    expect(data?.paid_amount).toBeNull()
  })

  it('refuses INSERT and DELETE on season_farms', async () => {
    const c = user.client
    expect((await c.from('season_farms').insert({ season_id: closedId, farm_id: spareFarmId })).error?.code).toBe('55000')
    expect((await c.from('season_farms').delete().eq('id', closedLinkId)).error?.code).toBe('55000')
    const { count } = await admin
      .from('season_farms')
      .select('id', { count: 'exact', head: true })
      .eq('season_id', closedId)
    expect(count).toBe(1)
  })

  it('refuses an UPDATE of the closed season row', async () => {
    const { error } = await user.client.from('seasons').update({ contractor_name: 'Changed' }).eq('id', closedId)
    expect(error?.code).toBe('55000')
    const { data } = await admin.from('seasons').select('contractor_name, status').eq('id', closedId).single()
    expect(data).toEqual({ contractor_name: 'Integrity C', status: 'closed' })
  })

  it('refuses moving an expense into or out of a closed season', async () => {
    const c = user.client
    const into = await c.from('expenses').update({ season_id: closedId }).eq('id', activeExpenseId)
    expect(into.error?.code).toBe('55000')
    expect((await expenseRow(activeExpenseId))?.season_id).toBe(activeId)

    const outOf = await c.from('expenses').update({ season_id: activeId }).eq('id', closedExpenseId)
    expect(outOf.error?.code).toBe('55000')
    expect((await expenseRow(closedExpenseId))?.season_id).toBe(closedId)
  })

  it('applies to service_role too (triggers ignore RLS bypass)', async () => {
    const { error } = await admin.from('expenses').insert(expense(closedId, 2025))
    expect(error?.code).toBe('55000')
  })

  it('still accepts the same writes on an active season', async () => {
    const c = user.client
    const ins = await c.from('expenses').insert(expense(activeId, 2026)).select('id').single()
    expect(ins.error).toBeNull()
    const upd = await c.from('expenses').update({ amount: 2000, landlord_cost: 2000 }).eq('id', ins.data!.id)
    expect(upd.error).toBeNull()
    const del = await c.from('expenses').delete().eq('id', ins.data!.id)
    expect(del.error).toBeNull()
  })

  it('deleteWorker refuses a worker with salary in a closed season, and the worker survives', async () => {
    // The pre-check query itself must find the salary; otherwise the DB
    // trigger's fallback would return the same message and hide a broken
    // pre-check.
    const { count, error: countError } = await user.client
      .from('expenses')
      .select('id, seasons!inner(status)', { count: 'exact', head: true })
      .eq('worker_id', workerId)
      .eq('seasons.status', 'closed')
    expect(countError).toBeNull()
    expect(count).toBe(1)

    setCurrentClient(user.client)
    const result = await deleteWorker(workerId)
    expect(result).toEqual({
      error: {
        _form: ["This worker has salary in a closed season and can't be deleted. Deactivate them instead."],
      },
    })
    const { data } = await admin.from('workers').select('id').eq('id', workerId).maybeSingle()
    expect(data?.id).toBe(workerId)
  })

  it('a paid_date before start_date is still refused by the trigger', async () => {
    const inst = await one<{ id: string }>(
      admin
        .from('installments')
        .insert({ season_id: activeId, installment_number: 9, expected_amount: 100, due_date: '2026-05-01' })
        .select('id')
        .single(),
      'active installment'
    )
    const { error } = await admin
      .from('installments')
      .update({ paid_amount: 100, paid_date: '2025-12-31' })
      .eq('id', inst.id)
    expect(error?.code).toBe('23514')
    const after = await admin
      .from('installments')
      .update({ paid_amount: 100, paid_date: '2027-01-15' })
      .eq('id', inst.id)
    expect(after.error).toBeNull()
  })
})

describe('deleting a closed season still cascades', () => {
  const admin = createAdminClient()
  let user: TestUser

  beforeAll(async () => {
    await resetDb(admin)
    user = await createTestUser('cascade')
  })

  afterAll(async () => {
    if (user) await deleteTestUser(user.id)
  })

  it('removes the closed season and all its children', async () => {
    const farmId = (await seedFarm(admin, user.id, 'Cascade Farm')).id
    const seasonId = (await seedSeason(admin, user.id, 2024)).id
    await one(admin.from('season_farms').insert({ season_id: seasonId, farm_id: farmId }).select('id').single(), 'link')
    const act = await one<{ id: string }>(
      admin
        .from('activities')
        .insert({ season_id: seasonId, farm_id: farmId, type: 'spray', activity_date: '2024-02-01' })
        .select('id')
        .single(),
      'activity'
    )
    // An expense linked to the activity: the activity's delete also SET NULLs it.
    await one(
      admin.from('expenses').insert(expense(seasonId, 2024, { linked_activity_id: act.id })).select('id').single(),
      'expense'
    )
    await one(
      admin
        .from('installments')
        .insert({ season_id: seasonId, installment_number: 1, expected_amount: 100, due_date: '2024-03-01' })
        .select('id')
        .single(),
      'installment'
    )
    await closeSeason(admin, seasonId)

    const { error } = await user.client.from('seasons').delete().eq('id', seasonId)
    expect(error).toBeNull()

    for (const table of ['seasons', 'season_farms', 'activities', 'expenses', 'installments'] as const) {
      const col = table === 'seasons' ? 'id' : 'season_id'
      const { count } = await admin.from(table).select('id', { count: 'exact', head: true }).eq(col, seasonId)
      expect(count, table).toBe(0)
    }
  })
})

describe('closing races with child writes (row lock)', () => {
  const admin = createAdminClient()
  // One user per test: one_active_season_per_owner would otherwise make a
  // failure in the first test (season left active) fail the second too.
  let userA: TestUser
  let userB: TestUser

  beforeAll(async () => {
    await resetDb(admin)
    userA = await createTestUser('race-a')
    userB = await createTestUser('race-b')
  })

  afterAll(async () => {
    if (userA) await deleteTestUser(userA.id)
    if (userB) await deleteTestUser(userB.id)
  })

  it('a child write waiting on a close fails once the close commits', async () => {
    const seasonId = (await seedSeason(admin, userA.id, 2027)).id
    const closer = await pgConnect()
    const writer = await pgConnect()
    try {
      await closer.query('BEGIN')
      await closer.query(`UPDATE public.seasons SET status = 'closed', closed_at = now() WHERE id = $1`, [seasonId])

      const write = writer.query(
        `INSERT INTO public.expenses (season_id, category, amount, landlord_cost, expense_date)
         VALUES ($1, 'misc', 10, 10, '2027-02-01')`,
        [seasonId]
      )
      write.catch(() => {})
      expect(await stillPending(write)).toBe(true)

      await closer.query('COMMIT')
      await expect(write).rejects.toMatchObject({ code: '55000' })

      const { count } = await admin.from('expenses').select('id', { count: 'exact', head: true }).eq('season_id', seasonId)
      expect(count).toBe(0)
    } finally {
      await closer.end()
      await writer.end()
    }
  })

  it('a close waits for an open child write, which then lands before the close', async () => {
    const seasonId = (await seedSeason(admin, userB.id, 2028)).id
    const closer = await pgConnect()
    const writer = await pgConnect()
    try {
      await writer.query('BEGIN')
      await writer.query(
        `INSERT INTO public.expenses (season_id, category, amount, landlord_cost, expense_date)
         VALUES ($1, 'misc', 10, 10, '2028-02-01')`,
        [seasonId]
      )

      const close = closer.query(
        `UPDATE public.seasons SET status = 'closed', closed_at = now() WHERE id = $1`,
        [seasonId]
      )
      close.catch(() => {})
      expect(await stillPending(close)).toBe(true)

      await writer.query('COMMIT')
      await expect(close).resolves.toMatchObject({ rowCount: 1 })

      const { count } = await admin.from('expenses').select('id', { count: 'exact', head: true }).eq('season_id', seasonId)
      expect(count).toBe(1)
    } finally {
      await closer.end()
      await writer.end()
    }
  })
})

describe('season references must be owned by the caller', () => {
  const admin = createAdminClient()
  let a: TestUser
  let b: TestUser
  let farmA: string
  let farmB: string
  let workerA: string
  let workerB: string
  let seasonB: string
  let linkB: string
  let expenseB: string

  beforeAll(async () => {
    await resetDb(admin)
    a = await createTestUser('owner-a')
    b = await createTestUser('owner-b')
    farmA = (await seedFarm(admin, a.id, 'A Farm')).id
    farmB = (await seedFarm(admin, b.id, 'B Farm')).id
    workerA = (await one<{ id: string }>(admin.from('workers').insert({ owner_id: a.id, name: 'A W' }).select('id').single(), 'wA')).id
    workerB = (await one<{ id: string }>(admin.from('workers').insert({ owner_id: b.id, name: 'B W' }).select('id').single(), 'wB')).id
    seasonB = (await seedSeason(admin, b.id, 2026)).id
    linkB = (
      await one<{ id: string }>(admin.from('season_farms').insert({ season_id: seasonB, farm_id: farmB }).select('id').single(), 'linkB')
    ).id
    expenseB = (
      await one<{ id: string }>(
        admin.from('expenses').insert(expense(seasonB, 2026, { category: 'labor', worker_id: workerB })).select('id').single(),
        'expenseB'
      )
    ).id
  })

  afterAll(async () => {
    if (a) await deleteTestUser(a.id)
    if (b) await deleteTestUser(b.id)
  })

  it("refuses linking another user's farm to your season (INSERT)", async () => {
    const { error } = await b.client.from('season_farms').insert({ season_id: seasonB, farm_id: farmA })
    expect(error?.code).toBe('42501')
  })

  it("refuses re-pointing your season_farms row to another user's farm (UPDATE)", async () => {
    const { error } = await b.client.from('season_farms').update({ farm_id: farmA }).eq('id', linkB)
    expect(error?.code).toBe('42501')
    const { data } = await admin.from('season_farms').select('farm_id').eq('id', linkB).single()
    expect(data?.farm_id).toBe(farmB)
  })

  it("refuses another user's worker on your expense (INSERT and UPDATE)", async () => {
    const ins = await b.client
      .from('expenses')
      .insert(expense(seasonB, 2026, { category: 'labor', worker_id: workerA }))
    expect(ins.error?.code).toBe('42501')

    const upd = await b.client.from('expenses').update({ worker_id: workerA }).eq('id', expenseB)
    expect(upd.error?.code).toBe('42501')
    const { data } = await admin.from('expenses').select('worker_id').eq('id', expenseB).single()
    expect(data?.worker_id).toBe(workerB)
  })

  it('still accepts your own farm and worker', async () => {
    const farmB2 = (await seedFarm(admin, b.id, 'B Farm 2')).id
    expect((await b.client.from('season_farms').insert({ season_id: seasonB, farm_id: farmB2 })).error).toBeNull()
    expect(
      (await b.client.from('expenses').insert(expense(seasonB, 2026, { category: 'labor', worker_id: workerB }))).error
    ).toBeNull()
  })
})

describe('policy inventory', () => {
  // A policy added to these tables changes who can write what. This list
  // must be updated on purpose, after reviewing the new policy against the
  // restrictive ones above.
  it('matches the reviewed set', async () => {
    const pg = await pgConnect()
    try {
      const { rows } = await pg.query<{ p: string }>(
        `select tablename || ' | ' || policyname || ' | ' || permissive || ' | ' || cmd as p
           from pg_policies
          where schemaname = 'public'
            and tablename in ('season_farms', 'expenses', 'activities', 'installments', 'profiles')
          order by 1`
      )
      expect(rows.map((r) => r.p)).toEqual([
        'activities | Users can manage own activities | PERMISSIVE | ALL',
        'expenses | Users can manage own expenses | PERMISSIVE | ALL',
        'expenses | expenses: worker owned by caller (insert) | RESTRICTIVE | INSERT',
        'expenses | expenses: worker owned by caller (update) | RESTRICTIVE | UPDATE',
        'installments | Users can manage own installments | PERMISSIVE | ALL',
        'profiles | Users can insert own landlord profile | PERMISSIVE | INSERT',
        'profiles | Users can read own profile | PERMISSIVE | SELECT',
        'profiles | Users can update own profile | PERMISSIVE | UPDATE',
        'season_farms | Users can manage own season_farms | PERMISSIVE | ALL',
        'season_farms | season_farms: farm owned by caller (insert) | RESTRICTIVE | INSERT',
        'season_farms | season_farms: farm owned by caller (update) | RESTRICTIVE | UPDATE',
      ])
    } finally {
      await pg.end()
    }
  })
})

describe('profile roles cannot be self-assigned', () => {
  const admin = createAdminClient()
  let user: TestUser
  let other: TestUser

  beforeAll(async () => {
    await resetDb(admin)
    user = await createTestUser('role')
    other = await createTestUser('role-other')
  })

  afterAll(async () => {
    if (user) await deleteTestUser(user.id)
    if (other) await deleteTestUser(other.id)
  })

  it("a signup asking for role 'admin' gets a landlord profile", async () => {
    const { data, error } = await admin.auth.admin.createUser({
      email: `test-wants-admin-${Date.now()}@example.com`,
      password: 'Passw0rd-wantsadmin',
      email_confirm: true,
      user_metadata: { full_name: 'Wants Admin', role: 'admin' },
    })
    expect(error).toBeNull()
    try {
      const { data: profile } = await admin.from('profiles').select('role').eq('id', data.user!.id).single()
      expect(profile?.role).toBe('landlord')
    } finally {
      await deleteTestUser(data.user!.id)
    }
  })

  it('a user cannot delete their own profile', async () => {
    await user.client.from('profiles').delete().eq('id', user.id)
    const { data } = await admin.from('profiles').select('id').eq('id', user.id).maybeSingle()
    expect(data?.id).toBe(user.id)
  })

  it("a user cannot insert a profile with role 'admin', only 'landlord'", async () => {
    // Remove the row as service_role, as if it had never been created.
    expect((await admin.from('profiles').delete().eq('id', user.id)).error).toBeNull()

    const asAdmin = await user.client
      .from('profiles')
      .insert({ id: user.id, full_name: 'x', email: user.email, role: 'admin' })
    expect(asAdmin.error?.code).toBe('42501')

    const asLandlord = await user.client
      .from('profiles')
      .insert({ id: user.id, full_name: 'x', email: user.email })
    expect(asLandlord.error).toBeNull()
    const { data } = await admin.from('profiles').select('role').eq('id', user.id).single()
    expect(data?.role).toBe('landlord')
  })

  it('a user may update name and phone but not role', async () => {
    expect((await user.client.from('profiles').update({ full_name: 'New Name', phone: '0300' }).eq('id', user.id)).error).toBeNull()
    expect((await user.client.from('profiles').update({ role: 'admin' }).eq('id', user.id)).error?.code).toBe('42501')
  })

  it('the role trigger still refuses a role change if the column privilege were granted', async () => {
    const pg = await pgConnect()
    try {
      await pg.query('BEGIN')
      await pg.query('GRANT UPDATE (role) ON public.profiles TO authenticated')
      await pg.query('SET LOCAL ROLE authenticated')
      await pg.query(`select set_config('request.jwt.claims', $1, true)`, [
        JSON.stringify({ sub: user.id, role: 'authenticated' }),
      ])
      await expect(
        pg.query(`UPDATE public.profiles SET role = 'admin' WHERE id = $1`, [user.id])
      ).rejects.toThrow(/role can only be changed by admin\/service/)
    } finally {
      await pg.query('ROLLBACK')
      await pg.end()
    }
  })

  it("an 'admin' profile grants no access to other users' data", async () => {
    const otherFarm = (await seedFarm(admin, other.id, 'Other Farm')).id
    expect((await admin.from('profiles').update({ role: 'admin' }).eq('id', user.id)).error).toBeNull()
    const { data } = await user.client.from('farms').select('id').eq('id', otherFarm)
    expect(data).toEqual([])
  })
})
