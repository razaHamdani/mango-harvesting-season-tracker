import { createClient } from '@/lib/supabase/server'
import type { Expense } from '@/types/database'

export type ExpenseWithFarm = Expense & {
  farm_name: string | null
}

export type ExpenseFilters = {
  category?: string
  farmId?: string
  dateFrom?: string
  dateTo?: string
}

export type ExpensesPage = {
  items: ExpenseWithFarm[]
  nextCursor: number | null
}

export type ExpenseTotals = {
  totalAmount: number
  totalLandlordCost: number
}

const PAGE_SIZE = 50

export async function getExpenses(
  seasonId: string,
  filters?: ExpenseFilters,
  offset = 0,
): Promise<ExpensesPage> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { items: [], nextCursor: null }
  }

  // Embed farms(name) to resolve farm_name in one round-trip.
  let query = supabase
    .from('expenses')
    .select('*, farms(name)')
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

  // Request one extra row to detect whether a next page exists.
  const { data, error } = await query
    .order('expense_date', { ascending: false })
    .order('created_at', { ascending: false })
    .range(offset, offset + PAGE_SIZE)

  if (error) {
    throw new Error(error.message)
  }

  const rows = (data ?? []) as (Expense & { farms: { name: string } | null })[]
  const hasMore = rows.length > PAGE_SIZE
  const pageRows = rows.slice(0, PAGE_SIZE)

  return {
    items: pageRows.map(({ farms, ...rest }) => ({
      ...rest,
      farm_name: rest.farm_id ? (farms?.name ?? null) : null,
    })),
    nextCursor: hasMore ? offset + PAGE_SIZE : null,
  }
}

// Separate aggregate query so the footer always reflects the true total
// for all matching expenses, regardless of how many pages are loaded.
export async function getExpenseTotals(
  seasonId: string,
  filters?: ExpenseFilters,
): Promise<ExpenseTotals> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { totalAmount: 0, totalLandlordCost: 0 }
  }

  let query = supabase
    .from('expenses')
    .select('amount, landlord_cost')
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

  const { data } = await query

  const rows = data ?? []
  return {
    totalAmount: rows.reduce((s, e) => s + e.amount, 0),
    totalLandlordCost: rows.reduce((s, e) => s + e.landlord_cost, 0),
  }
}
