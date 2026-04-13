import { createClient } from '@/lib/supabase/server'
import type { Season, Farm, Installment } from '@/types/database'

export type SeasonWithStats = Season & {
  total_acreage: number
  farm_count: number
}

export type SeasonDetail = Season & {
  farms: Farm[]
  installments: Installment[]
  total_acreage: number
  boxes_received: number
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

export async function getSeasonById(seasonId: string): Promise<SeasonDetail | null> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return null
  }

  // Fetch the season
  const { data: season, error: seasonError } = await supabase
    .from('seasons')
    .select('*')
    .eq('id', seasonId)
    .eq('owner_id', user.id)
    .single()

  if (seasonError || !season) {
    return null
  }

  // Fetch associated farms via season_farms join
  const { data: seasonFarms, error: sfError } = await supabase
    .from('season_farms')
    .select('farm_id')
    .eq('season_id', seasonId)

  if (sfError) {
    throw new Error(sfError.message)
  }

  const farmIds = (seasonFarms ?? []).map((sf) => sf.farm_id)
  let farms: Farm[] = []

  if (farmIds.length > 0) {
    const { data: farmsData, error: farmsError } = await supabase
      .from('farms')
      .select('*')
      .in('id', farmIds)

    if (farmsError) {
      throw new Error(farmsError.message)
    }

    farms = farmsData ?? []
  }

  const totalAcreage = farms.reduce((sum, f) => sum + f.acreage, 0)

  // Fetch installments
  const { data: installments, error: instError } = await supabase
    .from('installments')
    .select('*')
    .eq('season_id', seasonId)
    .order('installment_number', { ascending: true })

  if (instError) {
    throw new Error(instError.message)
  }

  // Compute boxes_received from harvest activities
  const { data: harvestData, error: harvestError } = await supabase
    .from('activities')
    .select('boxes_collected')
    .eq('season_id', seasonId)
    .eq('type', 'harvest')

  if (harvestError) {
    throw new Error(harvestError.message)
  }

  const boxesReceived = (harvestData ?? []).reduce(
    (sum, a) => sum + (a.boxes_collected ?? 0),
    0
  )

  return {
    ...season,
    farms,
    installments: installments ?? [],
    total_acreage: totalAcreage,
    boxes_received: boxesReceived,
  }
}
