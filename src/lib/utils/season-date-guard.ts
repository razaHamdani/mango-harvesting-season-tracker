import type { SupabaseClient } from '@supabase/supabase-js'
import { todayInAppTz } from '@/lib/utils/app-date'

export type GuardResult =
  | { ok: true }
  | { ok: false; error: string }

// Verifies a child-record date (YYYY-MM-DD) falls within an active season's
// window. Reused by createActivity, createExpense, and recordPayment.
//
// Uses lexicographic string comparison — safe for ISO YYYY-MM-DD dates.
// Caller is expected to have already verified season ownership; this helper
// only enforces lifecycle + date-window invariants.
export async function assertWithinSeasonWindow(
  supabase: SupabaseClient,
  seasonId: string,
  date: string,
): Promise<GuardResult> {
  const { data } = await supabase
    .from('seasons')
    .select('status, start_date, end_date')
    .eq('id', seasonId)
    .maybeSingle()

  if (!data) return { ok: false, error: 'Season not found.' }

  if (data.status !== 'active') {
    return { ok: false, error: 'Season is not active. Activate it before adding records.' }
  }

  // Mirrors the DB trigger enforce_season_date_range (inclusive bounds).
  if (date < data.start_date) {
    return {
      ok: false,
      error: `Date must be on or after the season start (${data.start_date}).`,
    }
  }

  if (date > data.end_date) {
    return {
      ok: false,
      error: `Date must be on or before the season end (${data.end_date}).`,
    }
  }

  // "Today" in the business timezone (APP_TIMEZONE, default Asia/Karachi) —
  // a UTC "today" would reject legitimate local entries between 00:00 and
  // 05:00 PKT every night.
  const today = todayInAppTz()
  if (date > today) {
    return { ok: false, error: 'Date cannot be in the future.' }
  }

  return { ok: true }
}
