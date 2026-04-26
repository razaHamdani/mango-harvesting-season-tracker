import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from './_user-context'
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
  const user = await getCurrentUser()
  if (!user) return { items: [], nextCursor: null }

  const supabase = await createClient()

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

  const rows = (data ?? []) as unknown as (Activity & { farms: { name: string } | null })[]
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

  // Single round-trip via embedded join (was: season_farms query + farms query).
  const { data, error } = await supabase
    .from('season_farms')
    .select('farms(*)')
    .eq('season_id', seasonId)
    .order('farms(name)')

  if (error) {
    throw new Error(error.message)
  }

  type Row = { farms: Farm | null }
  return (data as unknown as Row[])
    .map((row) => row.farms)
    .filter((f): f is Farm => f !== null)
}
