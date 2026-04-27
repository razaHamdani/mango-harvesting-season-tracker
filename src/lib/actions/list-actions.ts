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
import { getCurrentUser } from '@/lib/queries/_user-context'
import { mutationLimiter, enforceLimit } from '@/lib/utils/rate-limiter'

export async function loadMoreActivities(
  seasonId: string,
  filters: ActivityFilters,
  offset: number,
): Promise<ActivitiesPage> {
  const user = await getCurrentUser()
  if (!user) return { items: [], nextCursor: null }

  const { allowed } = await enforceLimit(mutationLimiter, `user:${user.id}`, true)
  if (!allowed) return { items: [], nextCursor: null }

  return getActivities(seasonId, filters, offset)
}

export async function loadMoreExpenses(
  seasonId: string,
  filters: ExpenseFilters,
  offset: number,
): Promise<ExpensesPage> {
  const user = await getCurrentUser()
  if (!user) return { items: [], nextCursor: null }

  const { allowed } = await enforceLimit(mutationLimiter, `user:${user.id}`, true)
  if (!allowed) return { items: [], nextCursor: null }

  return getExpenses(seasonId, filters, offset)
}
