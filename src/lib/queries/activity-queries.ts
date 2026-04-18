import { createClient } from '@/lib/supabase/server'
import type { Activity, Farm } from '@/types/database'

export type ActivityWithFarm = Activity & {
  farm_name: string
}

export type ActivityFilters = {
  type?: string
  farmId?: string
  dateFrom?: string
  dateTo?: string
}

export type ActivitiesPage = {
  items: ActivityWithFarm[]
  nextCursor: number | null
}

const PAGE_SIZE = 50

export async function getActivities(
  seasonId: string,
  filters?: ActivityFilters,
  offset = 0,
): Promise<ActivitiesPage> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { items: [], nextCursor: null }
  }

  // Embed farms(name) to resolve farm_name in one round-trip.
  let query = supabase
    .from('activities')
    .select('*, farms(name)')
    .eq('season_id', seasonId)

  if (filters?.type) {
    query = query.eq('type', filters.type as Activity['type'])
  }

  if (filters?.farmId) {
    query = query.eq('farm_id', filters.farmId)
  }

  if (filters?.dateFrom) {
    query = query.gte('activity_date', filters.dateFrom)
  }

  if (filters?.dateTo) {
    query = query.lte('activity_date', filters.dateTo)
  }

  // Request one extra row to detect whether a next page exists.
  const { data, error } = await query
    .order('activity_date', { ascending: false })
    .order('created_at', { ascending: false })
    .range(offset, offset + PAGE_SIZE)

  if (error) {
    throw new Error(error.message)
  }

  const rows = (data ?? []) as (Activity & { farms: { name: string } | null })[]
  const hasMore = rows.length > PAGE_SIZE
  const pageRows = rows.slice(0, PAGE_SIZE)

  return {
    items: pageRows.map(({ farms, ...rest }) => ({
      ...rest,
      farm_name: farms?.name ?? 'Unknown Farm',
    })),
    nextCursor: hasMore ? offset + PAGE_SIZE : null,
  }
}

export async function getSeasonFarms(seasonId: string): Promise<Farm[]> {
  const supabase = await createClient()

  const { data: seasonFarms, error: sfError } = await supabase
    .from('season_farms')
    .select('farm_id')
    .eq('season_id', seasonId)

  if (sfError) {
    throw new Error(sfError.message)
  }

  const farmIds = (seasonFarms ?? []).map((sf) => sf.farm_id)

  if (farmIds.length === 0) {
    return []
  }

  const { data: farms, error: farmsError } = await supabase
    .from('farms')
    .select('*')
    .in('id', farmIds)
    .order('name')

  if (farmsError) {
    throw new Error(farmsError.message)
  }

  return farms ?? []
}
