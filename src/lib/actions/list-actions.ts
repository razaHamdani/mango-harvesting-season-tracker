'use server'

import {
  getActivities,
  type ActivityFilters,
  type ActivitiesPage,
} from '@/lib/queries/activity-queries'
import {
  getExpenses,
  type ExpenseFilters,
  type ExpensesPage,
} from '@/lib/queries/expense-queries'

export async function loadMoreActivities(
  seasonId: string,
  filters: ActivityFilters,
  offset: number,
): Promise<ActivitiesPage> {
  return getActivities(seasonId, filters, offset)
}

export async function loadMoreExpenses(
  seasonId: string,
  filters: ExpenseFilters,
  offset: number,
): Promise<ExpensesPage> {
  return getExpenses(seasonId, filters, offset)
}
