import type { SupabaseClient } from '@supabase/supabase-js'

export type FarmGuard = { ok: true } | { ok: false; error: string }

/**
 * Verify farm_id is enrolled in season_farms for the given season.
 * Call after season-ownership pre-check so the season is already confirmed owned.
 */
export async function assertFarmInSeason(
  supabase: SupabaseClient,
  seasonId: string,
  farmId: string,
): Promise<FarmGuard> {
  const { data } = await supabase
    .from('season_farms')
    .select('id')
    .eq('season_id', seasonId)
    .eq('farm_id', farmId)
    .maybeSingle()

  if (!data) return { ok: false, error: 'Selected farm is not part of this season.' }
  return { ok: true }
}
