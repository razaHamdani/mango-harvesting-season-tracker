import Link from 'next/link'
import { Suspense } from 'react'
import { getExpenses, getExpenseTotals } from '@/lib/queries/expense-queries'
import { getSeasonFarms } from '@/lib/queries/activity-queries'
import { ExpenseFilters } from '@/components/expense/expense-filters'
import { ExpenseList } from '@/components/expense/expense-list'
import { buttonVariants } from '@/components/ui/button'

export default async function ExpensesPage({
  params,
  searchParams,
}: {
  params: Promise<{ seasonId: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { seasonId } = await params
  const sp = await searchParams

  const filters = {
    category: typeof sp.category === 'string' ? sp.category : undefined,
    farmId: typeof sp.farmId === 'string' ? sp.farmId : undefined,
    dateFrom: typeof sp.dateFrom === 'string' ? sp.dateFrom : undefined,
    dateTo: typeof sp.dateTo === 'string' ? sp.dateTo : undefined,
  }

  const [{ items: expenses, nextCursor }, totals, farms] = await Promise.all([
    getExpenses(seasonId, filters),
    getExpenseTotals(seasonId, filters),
    getSeasonFarms(seasonId),
  ])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Expenses</h2>
        <Link href={`/seasons/${seasonId}/expenses/new`} className={buttonVariants({ size: 'sm' })}>
          Add Expense
        </Link>
      </div>

      <Suspense>
        <ExpenseFilters farms={farms} />
      </Suspense>

      {expenses.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <p className="text-sm text-muted-foreground">
            No expenses recorded yet.
          </p>
          <Link href={`/seasons/${seasonId}/expenses/new`} className={buttonVariants({ variant: 'link', size: 'sm', className: 'mt-2' })}>
            Add your first expense
          </Link>
        </div>
      ) : (
        <ExpenseList
          initialItems={expenses}
          initialNextCursor={nextCursor}
          seasonId={seasonId}
          filters={filters}
          totalAmount={totals.totalAmount}
          totalLandlordCost={totals.totalLandlordCost}
        />
      )}
    </div>
  )
}
