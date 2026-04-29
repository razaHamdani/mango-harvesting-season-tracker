/**
 * 6D + 7E — Audit log integration tests.
 *
 * Verifies that the fn_audit_event trigger captures INSERT/UPDATE/DELETE
 * on core tables, and that RLS prevents cross-user reads.
 */
import { beforeAll, beforeEach, afterAll, describe, expect, it } from 'vitest'
import { createAdminClient, resetDb } from './helpers/admin'
import { createTestUser, deleteTestUser, TestUser } from './helpers/user'
import { setCurrentClient, clearCurrentClient } from './setup'

const admin = createAdminClient()

let userA: TestUser
let userB: TestUser

// Re-insert profiles for persistent test users after resetDb wipes them.
// resetDb truncates `profiles` but leaves `auth.users` intact — farms FK
// (`owner_id → profiles.id`) would violate without this.
async function restoreProfiles() {
  await admin.from('profiles').upsert([
    { id: userA.id, full_name: 'Audit A', email: userA.email },
    { id: userB.id, full_name: 'Audit B', email: userB.email },
  ])
}

beforeAll(async () => {
  await resetDb(admin)
  userA = await createTestUser('audit-a')
  userB = await createTestUser('audit-b')
})

afterAll(async () => {
  clearCurrentClient()
  if (userA) await deleteTestUser(userA.id)
  if (userB) await deleteTestUser(userB.id)
})

beforeEach(async () => {
  await resetDb(admin)
  await restoreProfiles()
  await admin.from('audit_events').delete().gt('id', 0)
})

async function insertFarm(user: TestUser) {
  const { data, error } = await user.client
    .from('farms')
    .insert({ owner_id: user.id, name: 'Audit Farm', acreage: 5 })
    .select('id')
    .single()
  if (error || !data) throw new Error(`farm insert failed: ${error?.message}`)
  return data.id as string
}

describe('audit trigger — INSERT', () => {
  it('records an INSERT event with correct actor_id and after_data', async () => {
    setCurrentClient(userA.client)
    const farmId = await insertFarm(userA)

    const { data: events, error } = await admin
      .from('audit_events')
      .select('*')
      .eq('table_name', 'farms')
      .eq('operation', 'INSERT')

    expect(error).toBeNull()
    expect(events).toHaveLength(1)
    const ev = events![0]
    expect(ev.actor_id).toBe(userA.id)
    expect(ev.before_data).toBeNull()
    expect(ev.after_data).not.toBeNull()
    expect(ev.after_data.id).toBe(farmId)
    expect(ev.row_id).toBe(farmId)
  })
})

describe('audit trigger — UPDATE', () => {
  it('captures before and after data on UPDATE', async () => {
    setCurrentClient(userA.client)
    const farmId = await insertFarm(userA)

    await admin.from('audit_events').delete().gt('id', 0)

    await userA.client
      .from('farms')
      .update({ name: 'Renamed Farm' })
      .eq('id', farmId)

    const { data: events } = await admin
      .from('audit_events')
      .select('*')
      .eq('table_name', 'farms')
      .eq('operation', 'UPDATE')

    expect(events).toHaveLength(1)
    const ev = events![0]
    expect(ev.before_data.name).toBe('Audit Farm')
    expect(ev.after_data.name).toBe('Renamed Farm')
    expect(ev.actor_id).toBe(userA.id)
  })
})

describe('audit trigger — DELETE', () => {
  it('captures before_data on DELETE and sets after_data to null', async () => {
    setCurrentClient(userA.client)
    const farmId = await insertFarm(userA)

    await admin.from('audit_events').delete().gt('id', 0)

    await userA.client.from('farms').delete().eq('id', farmId)

    const { data: events } = await admin
      .from('audit_events')
      .select('*')
      .eq('table_name', 'farms')
      .eq('operation', 'DELETE')

    expect(events).toHaveLength(1)
    const ev = events![0]
    expect(ev.before_data).not.toBeNull()
    expect(ev.before_data.id).toBe(farmId)
    expect(ev.after_data).toBeNull()
  })
})

describe('audit RLS — cross-user isolation', () => {
  it('user A cannot read audit events belonging to user B', async () => {
    setCurrentClient(userB.client)
    await insertFarm(userB)

    const { data: events, error } = await userA.client
      .from('audit_events')
      .select('*')

    expect(error).toBeNull()
    expect(events).toHaveLength(0)
  })

  it('user A can read their own audit events', async () => {
    setCurrentClient(userA.client)
    await insertFarm(userA)

    const { data: events, error } = await userA.client
      .from('audit_events')
      .select('*')

    expect(error).toBeNull()
    expect(events!.length).toBeGreaterThan(0)
    events!.forEach((ev) => expect(ev.actor_id).toBe(userA.id))
  })

  it('authenticated user cannot INSERT directly into audit_events', async () => {
    setCurrentClient(userA.client)
    const { error } = await userA.client.from('audit_events').insert({
      table_name: 'farms',
      operation: 'INSERT',
      after_data: {},
    })
    expect(error).not.toBeNull()
  })

  it('authenticated user cannot UPDATE their own audit events', async () => {
    setCurrentClient(userA.client)
    await insertFarm(userA)

    // Get the ID of an audit event the user can read.
    const { data: own } = await userA.client.from('audit_events').select('id').limit(1)
    expect(own?.length).toBe(1)

    // Attempt to update the actor_id (or any field) — RLS has no UPDATE policy,
    // so the row count returned is 0 (PostgREST silently drops the operation).
    const { data: updated } = await userA.client
      .from('audit_events')
      .update({ table_name: 'tampered' })
      .eq('id', own![0].id)
      .select()
    expect(updated).toHaveLength(0)
  })

  it('authenticated user cannot DELETE their own audit events', async () => {
    setCurrentClient(userA.client)
    await insertFarm(userA)

    const { data: own } = await userA.client.from('audit_events').select('id').limit(1)
    const targetId = own![0].id

    const { data: deleted } = await userA.client
      .from('audit_events')
      .delete()
      .eq('id', targetId)
      .select()
    expect(deleted).toHaveLength(0)

    // Confirm the row still exists via admin.
    const { data: still } = await admin
      .from('audit_events')
      .select('id')
      .eq('id', targetId)
    expect(still).toHaveLength(1)
  })
})

describe('audit trigger — sentinel actor for sessionless operations', () => {
  // When service-role deletes rows directly (no authenticated session), auth.uid()
  // returns NULL. The trigger COALESCE converts this to the sentinel UUID.
  // This covers cascade deletes that run without a session context, e.g. when
  // auth.users is deleted and child tables cascade via service-role.
  it('service-role DELETE sets actor_id to the sentinel UUID', async () => {
    setCurrentClient(userA.client)
    const farmId = await insertFarm(userA)

    await admin.from('audit_events').delete().gt('id', 0)

    // Service-role delete: no auth session → auth.uid() = NULL → sentinel
    await admin.from('farms').delete().eq('id', farmId)

    const { data: events } = await admin
      .from('audit_events')
      .select('*')
      .eq('table_name', 'farms')
      .eq('operation', 'DELETE')

    expect(events?.length).toBeGreaterThan(0)
    expect(events![0].actor_id).toBe('00000000-0000-0000-0000-000000000000')
    expect(events![0].before_data.id).toBe(farmId)
    expect(events![0].after_data).toBeNull()
  })
})

describe('audit triggers — per-table smoke', () => {
  it('seasons trigger fires on INSERT', async () => {
    setCurrentClient(userA.client)

    const { data: season, error } = await admin
      .from('seasons')
      .insert({
        owner_id: userA.id,
        year: 2099,
        contractor_name: 'Trigger Test',
        predetermined_amount: 1000,
        spray_landlord_pct: 50,
        fertilizer_landlord_pct: 50,
        agreed_boxes: 0,
        status: 'draft',
      })
      .select('id')
      .single()
    expect(error).toBeNull()

    const { data: events } = await admin
      .from('audit_events')
      .select('*')
      .eq('table_name', 'seasons')
      .eq('operation', 'INSERT')
      .eq('row_id', season!.id)

    expect(events?.length).toBeGreaterThan(0)
  })

  it('expenses trigger fires on INSERT', async () => {
    setCurrentClient(userA.client)

    const { data: season } = await admin
      .from('seasons')
      .insert({
        owner_id: userA.id,
        year: 2098,
        contractor_name: 'Expense Trigger Test',
        predetermined_amount: 1000,
        spray_landlord_pct: 50,
        fertilizer_landlord_pct: 50,
        agreed_boxes: 0,
        status: 'draft',
      })
      .select('id')
      .single()

    await admin.from('audit_events').delete().gt('id', 0)

    const { data: expense, error } = await admin
      .from('expenses')
      .insert({
        season_id: season!.id,
        category: 'spray',
        amount: 500,
        landlord_cost: 250,
        expense_date: '2098-01-01',
      })
      .select('id')
      .single()
    expect(error).toBeNull()

    const { data: events } = await admin
      .from('audit_events')
      .select('*')
      .eq('table_name', 'expenses')
      .eq('operation', 'INSERT')
      .eq('row_id', expense!.id)

    expect(events?.length).toBeGreaterThan(0)
  })

  it('installments trigger fires on INSERT', async () => {
    const { data: season } = await admin
      .from('seasons')
      .insert({
        owner_id: userA.id,
        year: 2097,
        contractor_name: 'Installment Trigger Test',
        predetermined_amount: 1000,
        spray_landlord_pct: 50,
        fertilizer_landlord_pct: 50,
        agreed_boxes: 0,
        status: 'draft',
      })
      .select('id')
      .single()

    await admin.from('audit_events').delete().gt('id', 0)

    const { data: inst, error } = await admin
      .from('installments')
      .insert({
        season_id: season!.id,
        installment_number: 1,
        expected_amount: 500,
        due_date: '2097-06-01',
      })
      .select('id')
      .single()
    expect(error).toBeNull()

    const { data: events } = await admin
      .from('audit_events')
      .select('*')
      .eq('table_name', 'installments')
      .eq('operation', 'INSERT')
      .eq('row_id', inst!.id)

    expect(events?.length).toBeGreaterThan(0)
  })

  it('activities trigger fires on INSERT', async () => {
    const farmId = await insertFarm(userA)
    const { data: season } = await admin
      .from('seasons')
      .insert({
        owner_id: userA.id,
        year: 2096,
        contractor_name: 'Activity Trigger Test',
        predetermined_amount: 1000,
        spray_landlord_pct: 50,
        fertilizer_landlord_pct: 50,
        agreed_boxes: 0,
        status: 'draft',
      })
      .select('id')
      .single()

    await admin.from('audit_events').delete().gt('id', 0)

    const { data: activity, error } = await admin
      .from('activities')
      .insert({
        season_id: season!.id,
        farm_id: farmId,
        type: 'spray',
        activity_date: '2096-04-01',
      })
      .select('id')
      .single()
    expect(error).toBeNull()

    const { data: events } = await admin
      .from('audit_events')
      .select('*')
      .eq('table_name', 'activities')
      .eq('operation', 'INSERT')
      .eq('row_id', activity!.id)

    expect(events?.length).toBeGreaterThan(0)
  })
})
