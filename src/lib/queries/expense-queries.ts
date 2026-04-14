import { createClient } from '@/lib/supabase/server'
import type { Expense } from '@/types/database'

export type ExpenseWithFarm = Expense & {
  farm_name: string | null
}

export async function getExpenses(
  seasonId: string,
  filters?: {
    category?: string
    farmId?: string
    dateFrom?: string
    dateTo?: string
  }
): Promise<ExpenseWithFarm[]> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return []
  }

  let query = supabase
    .from('expenses')
    .select('*')
    .eq('season_id', seasonId)

  if (filters?.category) {
    query = query.eq('category', filters.category as Expense['category'])
  }

  if (filters?.farmId) {
    query = query.eq('farm_id', filters.farmId)
  }

  if (filters?.dateFrom) {
    query = query.gte('expense_date', filters.dateFrom)
  }

  if (filters?.dateTo) {
    query = query.lte('expense_date', filters.dateTo)
  }

  query = query
    .order('expense_date', { ascending: false })
    .order('created_at', { ascending: false })

  const { data: expenses, error } = await query

  if (error) {
    throw new Error(error.message)
  }

  if (!expenses || expenses.length === 0) {
    return []
  }

  // Fetch farm names for expenses that have a farm_id
  const farmIds = [
    ...new Set(expenses.map((e) => e.farm_id).filter(Boolean)),
  ] as string[]

  let farmNameMap = new Map<string, string>()

  if (farmIds.length > 0) {
    const { data: farms, error: farmsError } = await supabase
      .from('farms')
      .select('id, name')
      .in('id', farmIds)

    if (farmsError) {
      throw new Error(farmsError.message)
    }

    farmNameMap = new Map((farms ?? []).map((f) => [f.id, f.name]))
  }

  return expenses.map((expense) => ({
    ...expense,
    farm_name: expense.farm_id
      ? farmNameMap.get(expense.farm_id) ?? null
      : null,
  }))
}
