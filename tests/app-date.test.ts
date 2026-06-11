/**
 * B3 — "today" in the business timezone.
 *
 * The discriminating window is 19:00–24:00 UTC: Karachi (UTC+5) has already
 * rolled to the next date while UTC has not. Faking only Date (not timers —
 * fake timers would break network calls elsewhere) makes the boundary
 * deterministic.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { todayInAppTz } from '@/lib/utils/app-date'
import { assertWithinSeasonWindow } from '@/lib/utils/season-date-guard'
import type { SupabaseClient } from '@supabase/supabase-js'

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
})

function fakeDate(iso: string) {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(iso))
}

// Minimal stub: the guard only calls .from().select().eq().maybeSingle().
function stubSeasonClient(season: { status: string; started_at: string | null }) {
  return {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: season }),
        }),
      }),
    }),
  } as unknown as SupabaseClient
}

describe('todayInAppTz', () => {
  it('returns the Karachi date, which is tomorrow in UTC after 19:00 UTC', () => {
    fakeDate('2026-06-11T21:00:00Z') // 02:00 on the 12th in Karachi
    expect(todayInAppTz()).toBe('2026-06-12')
  })

  it('matches the UTC date when the two calendars agree', () => {
    fakeDate('2026-06-11T10:00:00Z') // 15:00 on the 11th in Karachi
    expect(todayInAppTz()).toBe('2026-06-11')
  })

  it('respects the APP_TIMEZONE override', () => {
    fakeDate('2026-06-11T21:00:00Z') // still the 11th in New York (17:00)
    vi.stubEnv('APP_TIMEZONE', 'America/New_York')
    expect(todayInAppTz()).toBe('2026-06-11')
  })
})

describe('assertWithinSeasonWindow — timezone boundary (B3)', () => {
  const season = { status: 'active', started_at: '2026-01-01' }

  it('accepts a record dated "today in Karachi" at 21:00 UTC (C4 regression)', async () => {
    fakeDate('2026-06-11T21:00:00Z')
    // 2026-06-12 is tomorrow in UTC — the old UTC-based check rejected it.
    const result = await assertWithinSeasonWindow(stubSeasonClient(season), 's1', '2026-06-12')
    expect(result).toEqual({ ok: true })
  })

  it('rejects a record dated tomorrow in Karachi', async () => {
    fakeDate('2026-06-11T21:00:00Z')
    const result = await assertWithinSeasonWindow(stubSeasonClient(season), 's1', '2026-06-13')
    expect(result).toEqual({ ok: false, error: 'Date cannot be in the future.' })
  })
})
