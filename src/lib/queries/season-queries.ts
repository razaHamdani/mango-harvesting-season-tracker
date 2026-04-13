import { createClient } from '@/lib/supabase/server'
import type { Season } from '@/types/database'

export type SeasonWithStats = Season & {
  total_acreage: number
  farm_count: number
}

export async function listSeasons(): Promise<SeasonWithStats[]> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return []
  }

  const { data: seasons, error: seasonsError } = await supabase
    .from('seasons')
    .select('*')
    .eq('owner_id', user.id)
    .order('year', { ascending: false })

  if (seasonsError) {
    throw new Error(seasonsError.message)
  }

  if (!seasons || seasons.length === 0) {
    return []
  }

  const seasonIds = seasons.map((s) => s.id)

  // Fetch season_farms links
  const { data: seasonFarms, error: sfError } = await supabase
    .from('season_farms')
    .select('season_id, farm_id')
    .in('season_id', seasonIds)

  if (sfError) {
    throw new Error(sfError.message)
  }

  // Fetch farms for acreage lookup
  const farmIds = [...new Set((seasonFarms ?? []).map((sf) => sf.farm_id))]
  let farmAcreageMap = new Map<string, number>()

  if (farmIds.length > 0) {
    const { data: farms, error: farmsError } = await supabase
      .from('farms')
      .select('id, acreage')
      .in('id', farmIds)

    if (farmsError) {
      throw new Error(farmsError.message)
    }

    farmAcreageMap = new Map((farms ?? []).map((f) => [f.id, f.acreage]))
  }

  // Aggregate stats per season
  const statsMap = new Map<string, { farm_count: number; total_acreage: number }>()
  for (const sf of seasonFarms ?? []) {
    const existing = statsMap.get(sf.season_id) ?? { farm_count: 0, total_acreage: 0 }
    existing.farm_count += 1
    existing.total_acreage += farmAcreageMap.get(sf.farm_id) ?? 0
    statsMap.set(sf.season_id, existing)
  }

  return seasons.map((season) => {
    const stats = statsMap.get(season.id) ?? { farm_count: 0, total_acreage: 0 }
    return { ...season, ...stats }
  })
}
