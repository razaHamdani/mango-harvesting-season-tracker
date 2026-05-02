import type { SupabaseClient } from '@supabase/supabase-js'

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
    .select('started_at, status')
    .eq('id', seasonId)
    .maybeSingle()

  if (!data) return { ok: false, error: 'Season not found.' }

  if (data.status !== 'active') {
    return { ok: false, error: 'Season is not active. Activate it before adding records.' }
  }

  // started_at is guaranteed non-null when status='active' by the DB CHECK
  // constraint, but narrow for the type system.
  if (!data.started_at) {
    return { ok: false, error: 'Season has no start date.' }
  }

  if (date < data.started_at) {
    return {
      ok: false,
      error: `Date must be on or after the season start (${data.started_at}).`,
    }
  }

  return { ok: true }
}
