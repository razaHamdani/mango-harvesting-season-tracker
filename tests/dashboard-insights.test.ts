/**
 * R3 — getDashboardData must surface a failed insights RPC as
 * `insights: null` (explicit UI error state), never as a zeroed object:
 * fake zeros on a financial dashboard are indistinguishable from reality.
 *
 * Uses a stub Supabase client (queued per-table results) because a real
 * local Supabase can't be made to fail the RPC deterministically.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { setCurrentClient, clearCurrentClient } from './setup'

const { logErrorMock } = vi.hoisted(() => ({
  logErrorMock: vi.fn(async () => {}),
}))
vi.mock('@/lib/utils/logger', () => ({ logError: logErrorMock }))

// Deterministic auth: bypass the React cache()-wrapped helper.
vi.mock('@/lib/queries/_user-context', () => ({
  getCurrentUser: async () => ({ id: 'user-1' }),
}))

import { getDashboardData } from '@/lib/queries/season-queries'

const ACTIVE_SEASON = {
  id: 's1',
  year: 2026,
  status: 'active',
  started_at: '2026-01-01',
  contractor_name: 'C',
  predetermined_amount: 100_000,
  agreed_boxes: 100,
}

const INSIGHTS = {
  predetermined_amount: 100_000,
  total_acreage: 5,
  agreed_boxes: 100,
  boxes_received: 10,
  total_expenses: 2_000,
  expenses_by_category: { misc: 2_000 },
  total_payments_received: 50_000,
  installments_paid: 1,
  installments_total: 2,
}

// Chainable thenable: every builder method returns itself; awaiting it
// resolves to the queued result for that table access.
function chainFor(result: unknown) {
  const t: Record<string, unknown> = {}
  for (const m of ['select', 'eq', 'is', 'order', 'limit', 'maybeSingle', 'single']) {
    t[m] = () => t
  }
  t.then = (onOk: (v: unknown) => unknown, onErr?: (e: unknown) => unknown) =>
    Promise.resolve(result).then(onOk, onErr)
  return t
}

function stubClient(rpcResult: { data: unknown; error: unknown }) {
  // Order matches getDashboardData's calls per table.
  const queues: Record<string, unknown[]> = {
    seasons: [{ count: 1 }, { data: ACTIVE_SEASON, error: null }],
    farms: [{ count: 0 }],
    workers: [{ count: 0 }],
    installments: [{ data: [], error: null }],
    activities: [{ data: [], error: null }],
  }
  return {
    from: (table: string) => chainFor(queues[table]?.shift() ?? { data: null, error: null }),
    rpc: async () => rpcResult,
  } as unknown as SupabaseClient
}

afterEach(() => {
  clearCurrentClient()
  logErrorMock.mockClear()
})

describe('getDashboardData — insights failure state (R3)', () => {
  it('returns insights: null and logs when the RPC errors', async () => {
    setCurrentClient(stubClient({ data: null, error: { message: 'boom', code: 'XX000' } }))

    const data = await getDashboardData()

    expect(data.activeSeason).not.toBeNull()
    expect(data.activeSeason!.insights).toBeNull()
    expect(logErrorMock).toHaveBeenCalledWith(
      'getDashboardData.insights',
      expect.objectContaining({ message: 'boom' })
    )
  })

  it('returns the real insights object on the happy path, no log', async () => {
    setCurrentClient(stubClient({ data: INSIGHTS, error: null }))

    const data = await getDashboardData()

    expect(data.activeSeason!.insights).toEqual(INSIGHTS)
    expect(logErrorMock).not.toHaveBeenCalled()
  })
})
