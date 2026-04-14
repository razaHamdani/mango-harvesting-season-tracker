import { createClient } from '@/lib/supabase/server'
import type { Season, Farm, Installment, Activity } from '@/types/database'

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

export type SeasonInsights = {
  predetermined_amount: number
  total_acreage: number
  agreed_boxes: number
  boxes_received: number
  total_expenses: number
  expenses_by_category: Record<string, number>
  total_payments_received: number
  installments_paid: number
  installments_total: number
}

export async function getSeasonInsights(
  seasonId: string
): Promise<SeasonInsights | null> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return null
  }

  // Verify ownership before calling the RPC
  const { data: season, error: seasonError } = await supabase
    .from('seasons')
    .select('id')
    .eq('id', seasonId)
    .eq('owner_id', user.id)
    .single()

  if (seasonError || !season) {
    return null
  }

  const { data, error } = await supabase.rpc('get_season_insights', {
    p_season_id: seasonId,
  })

  if (error || !data) {
    return null
  }

  return data as unknown as SeasonInsights
}

export type DashboardData = {
  activeSeason:
    | (Season & {
        insights: SeasonInsights
        upcomingInstallments: Installment[]
        recentActivities: (Activity & { farm_name: string })[]
      })
    | null
  totalSeasons: number
  totalFarms: number
  totalWorkers: number
}

export async function getDashboardData(): Promise<DashboardData> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const empty: DashboardData = {
    activeSeason: null,
    totalSeasons: 0,
    totalFarms: 0,
    totalWorkers: 0,
  }

  if (!user) return empty

  const [seasonsRes, farmsRes, workersRes] = await Promise.all([
    supabase
      .from('seasons')
      .select('*')
      .eq('owner_id', user.id)
      .order('year', { ascending: false }),
    supabase.from('farms').select('id', { count: 'exact', head: true }).eq('owner_id', user.id),
    supabase.from('workers').select('id', { count: 'exact', head: true }).eq('owner_id', user.id),
  ])

  const seasons = seasonsRes.data ?? []
  const active = seasons.find((s) => s.status === 'active') ?? null

  const result: DashboardData = {
    activeSeason: null,
    totalSeasons: seasons.length,
    totalFarms: farmsRes.count ?? 0,
    totalWorkers: workersRes.count ?? 0,
  }

  if (!active) return result

  const [insightsRes, unpaidInstRes, activitiesRes, seasonFarmsRes] = await Promise.all([
    supabase.rpc('get_season_insights', { p_season_id: active.id }),
    supabase
      .from('installments')
      .select('*')
      .eq('season_id', active.id)
      .is('paid_amount', null)
      .order('due_date', { ascending: true })
      .limit(5),
    supabase
      .from('activities')
      .select('*')
      .eq('season_id', active.id)
      .order('activity_date', { ascending: false })
      .limit(5),
    supabase.from('season_farms').select('farm_id').eq('season_id', active.id),
  ])

  const farmIds = (seasonFarmsRes.data ?? []).map((sf) => sf.farm_id)
  let farmNameMap = new Map<string, string>()
  if (farmIds.length > 0) {
    const { data: farmsData } = await supabase
      .from('farms')
      .select('id, name')
      .in('id', farmIds)
    farmNameMap = new Map((farmsData ?? []).map((f) => [f.id, f.name]))
  }

  const recentActivities = (activitiesRes.data ?? []).map((a) => ({
    ...a,
    farm_name: farmNameMap.get(a.farm_id) ?? '—',
  }))

  result.activeSeason = {
    ...active,
    insights: (insightsRes.data as unknown as SeasonInsights) ?? {
      predetermined_amount: active.predetermined_amount,
      total_acreage: 0,
      agreed_boxes: active.agreed_boxes,
      boxes_received: 0,
      total_expenses: 0,
      expenses_by_category: {},
      total_payments_received: 0,
      installments_paid: 0,
      installments_total: 0,
    },
    upcomingInstallments: unpaidInstRes.data ?? [],
    recentActivities,
  }

  return result
}
