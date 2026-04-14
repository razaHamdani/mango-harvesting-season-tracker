import { createClient } from '@/lib/supabase/server'
import type { Activity, Farm } from '@/types/database'

export type ActivityWithFarm = Activity & {
  farm_name: string
}

export async function getActivities(
  seasonId: string,
  filters?: {
    type?: string
    farmId?: string
    dateFrom?: string
    dateTo?: string
  }
): Promise<ActivityWithFarm[]> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return []
  }

  let query = supabase
    .from('activities')
    .select('*')
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

  query = query
    .order('activity_date', { ascending: false })
    .order('created_at', { ascending: false })

  const { data: activities, error } = await query

  if (error) {
    throw new Error(error.message)
  }

  if (!activities || activities.length === 0) {
    return []
  }

  // Fetch farm names for the activities
  const farmIds = [...new Set(activities.map((a) => a.farm_id))]

  const { data: farms, error: farmsError } = await supabase
    .from('farms')
    .select('id, name')
    .in('id', farmIds)

  if (farmsError) {
    throw new Error(farmsError.message)
  }

  const farmNameMap = new Map<string, string>(
    (farms ?? []).map((f) => [f.id, f.name])
  )

  return activities.map((activity) => ({
    ...activity,
    farm_name: farmNameMap.get(activity.farm_id) ?? 'Unknown Farm',
  }))
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

