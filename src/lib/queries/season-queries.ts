import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from './_user-context'
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
  const user = await getCurrentUser()
  if (!user) return []

  const supabase = await createClient()

  // Single round-trip: embed season_farms → farms to compute acreage/count in JS.
  const { data: seasons, error } = await supabase
    .from('seasons')
    .select('*, season_farms(farm_id, farms(acreage))')
    .eq('owner_id', user.id)
    .order('year', { ascending: false })

  if (error) {
    throw new Error(error.message)
  }

  type SeasonRow = Season & {
    season_farms: Array<{ farm_id: string; farms: { acreage: number } | null }>
  }

  return (seasons as unknown as SeasonRow[]).map((row) => {
    const { season_farms, ...season } = row
    const farm_count = season_farms.length
    const total_acreage = season_farms.reduce(
      (s, sf) => s + (sf.farms?.acreage ?? 0),
      0,
    )
    return { ...season, farm_count, total_acreage }
  })
}

export async function getSeasonById(seasonId: string): Promise<SeasonDetail | null> {
  const user = await getCurrentUser()
  if (!user) return null

  const supabase = await createClient()

  // Round-trip 1: season + linked farms + installments via embedded joins.
  const { data: row, error } = await supabase
    .from('seasons')
    .select('*, season_farms(farms(*)), installments(*)')
    .eq('id', seasonId)
    .eq('owner_id', user.id)
    .single()

  if (error || !row) {
    return null
  }

  type SeasonRow = Season & {
    season_farms: Array<{ farms: Farm | null }>
    installments: Installment[]
  }

  const data = row as unknown as SeasonRow
  const farms = (data.season_farms ?? [])
    .map((sf) => sf.farms)
    .filter((f): f is Farm => f !== null)

  const installments = (data.installments ?? []).sort(
    (a, b) => a.installment_number - b.installment_number,
  )

  const totalAcreage = farms.reduce((sum, f) => sum + f.acreage, 0)

  // Round-trip 2: harvest aggregate (cannot be filtered inside an embedded relation).
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
    0,
  )

  return {
    ...data,
    farms,
    installments,
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
  const user = await getCurrentUser()
  if (!user) return null

  const supabase = await createClient()

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
  const user = await getCurrentUser()

  const empty: DashboardData = {
    activeSeason: null,
    totalSeasons: 0,
    totalFarms: 0,
    totalWorkers: 0,
  }

  if (!user) return empty

  const supabase = await createClient()

  // Parallel: count queries + active season lookup (no JS-side filter needed).
  const [seasonsCountRes, activeSeasonRes, farmsRes, workersRes] = await Promise.all([
    supabase
      .from('seasons')
      .select('id', { count: 'exact', head: true })
      .eq('owner_id', user.id),
    supabase
      .from('seasons')
      .select('*')
      .eq('owner_id', user.id)
      .eq('status', 'active')
      .limit(1)
      .maybeSingle(),
    supabase.from('farms').select('id', { count: 'exact', head: true }).eq('owner_id', user.id),
    supabase.from('workers').select('id', { count: 'exact', head: true }).eq('owner_id', user.id),
  ])

  const active = activeSeasonRes.data ?? null

  const result: DashboardData = {
    activeSeason: null,
    totalSeasons: seasonsCountRes.count ?? 0,
    totalFarms: farmsRes.count ?? 0,
    totalWorkers: workersRes.count ?? 0,
  }

  if (!active) return result

  // Embed farms(name) in activities to eliminate the season_farms + farms round-trips.
  const [insightsRes, unpaidInstRes, activitiesRes] = await Promise.all([
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
      .select('*, farms(name)')
      .eq('season_id', active.id)
      .order('activity_date', { ascending: false })
      .limit(5),
  ])

  type RawActivity = Activity & { farms: { name: string } | null }
  const recentActivities = (activitiesRes.data as unknown as RawActivity[] ?? []).map(
    ({ farms, ...a }) => ({ ...a, farm_name: farms?.name ?? '—' }),
  )

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
