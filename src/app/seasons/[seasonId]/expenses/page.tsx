import Link from 'next/link'
import { Suspense } from 'react'
import { Receipt, Plus } from 'lucide-react'
import {
  getExpenses,
  getExpenseTotals,
} from '@/lib/queries/expense-queries'
import { getSeasonFarms } from '@/lib/queries/activity-queries'
import { ExpenseFilters } from '@/components/expense/expense-filters'
import { ExpenseList } from '@/components/expense/expense-list'
import { EmptyState } from '@/components/shared/empty-state'
import { buttonVariants } from '@/components/ui/button'
import { formatPKR } from '@/lib/utils/format'

const CATEGORIES = ['electricity', 'spray', 'fertilizer', 'labor', 'misc']

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

  const [{ items: expenses, nextCursor }, totals, farms, ...categoryTotals] =
    await Promise.all([
      getExpenses(seasonId, filters),
      getExpenseTotals(seasonId, filters),
      getSeasonFarms(seasonId),
      ...CATEGORIES.map((c) => getExpenseTotals(seasonId, { category: c })),
    ])

  const counts: Record<string, number> = {}
  CATEGORIES.forEach((c, i) => {
    counts[c] = categoryTotals[i].totalAmount
  })

  const totalAmount = totals.totalAmount
  const totalLandlord = totals.totalLandlordCost
  const totalContractor = Math.max(0, totalAmount - totalLandlord)
  const landlordPct =
    totalAmount > 0 ? Math.round((totalLandlord / totalAmount) * 100) : 0
  const contractorPct =
    totalAmount > 0 ? Math.round((totalContractor / totalAmount) * 100) : 0

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold tracking-tight text-[color:var(--heading)]">
          Expenses
        </h2>
        <Link
          href={`/seasons/${seasonId}/expenses/new`}
          className={buttonVariants({ size: 'sm' })}
        >
          <Plus className="h-4 w-4" />
          Add expense
        </Link>
      </div>

      <Suspense>
        <ExpenseFilters farms={farms} amounts={counts} />
      </Suspense>

      {/* Totals strip */}
      {expenses.length > 0 && (
        <div className="card card__pad" style={{ background: 'var(--bg-2)' }}>
          <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_220px] items-center">
            <div>
              <div className="section-label">Total</div>
              <div className="mono tnum mt-1 text-[22px] font-semibold text-[color:var(--heading)]">
                {formatPKR(totalAmount)}
              </div>
            </div>
            <div>
              <div className="section-label flex items-center gap-1.5">
                <span
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ background: 'var(--mango)' }}
                />
                Landlord share
              </div>
              <div className="mono tnum mt-1 text-[22px] font-semibold text-[color:var(--heading)]">
                {formatPKR(totalLandlord)}
              </div>
              <div className="mt-0.5 text-[11.5px] text-[color:var(--text-muted)]">
                {landlordPct}% of expenses
              </div>
            </div>
            <div>
              <div className="section-label flex items-center gap-1.5">
                <span
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ background: 'var(--soil)' }}
                />
                Contractor share
              </div>
              <div className="mono tnum mt-1 text-[22px] font-semibold text-[color:var(--heading)]">
                {formatPKR(totalContractor)}
              </div>
              <div className="mt-0.5 text-[11.5px] text-[color:var(--text-muted)]">
                {contractorPct}% of expenses
              </div>
            </div>
            <div>
              <div className="split-bar split-bar--prominent">
                <div
                  className="seg-landlord"
                  style={{ width: `${landlordPct}%` }}
                />
                <div
                  className="seg-contractor"
                  style={{ width: `${contractorPct}%` }}
                />
              </div>
              <div className="mt-2 flex justify-between text-[11.5px] text-[color:var(--text-muted)]">
                <span>L {landlordPct}%</span>
                <span>C {contractorPct}%</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {expenses.length === 0 ? (
        <EmptyState
          icon={<Receipt />}
          title="No expenses recorded yet"
          description="Track the cost of sprays, fertilizer, electricity, labor and miscellaneous spend."
          action={
            <Link
              href={`/seasons/${seasonId}/expenses/new`}
              className={buttonVariants({ size: 'sm' })}
            >
              Add first expense
            </Link>
          }
        />
      ) : (
        <ExpenseList
          key={JSON.stringify(filters)}
          initialItems={expenses}
          initialNextCursor={nextCursor}
          seasonId={seasonId}
          filters={filters}
        />
      )}
    </div>
  )
}
