'use client'

import { useState, useTransition } from 'react'
import { Zap, Sparkles, Leaf, User, Package, Trash2 } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type {
  ExpenseWithFarm,
  ExpenseFilters,
} from '@/lib/queries/expense-queries'
import { PhotoThumbnailClient } from '@/components/photo/photo-thumbnail-client'
import { deleteExpense } from '@/lib/actions/expense-actions'
import { loadMoreExpenses } from '@/lib/actions/list-actions'
import { formatPKR, formatDate } from '@/lib/utils/format'
import { Button } from '@/components/ui/button'

const CATEGORY_META: Record<
  string,
  { icon: LucideIcon; cls: 'spray' | 'water' | 'fertilize' | 'harvest' | 'expense' }
> = {
  spray: { icon: Sparkles, cls: 'spray' },
  fertilizer: { icon: Leaf, cls: 'fertilize' },
  electricity: { icon: Zap, cls: 'water' },
  labor: { icon: User, cls: 'harvest' },
  misc: { icon: Package, cls: 'expense' },
}

interface ExpenseListProps {
  initialItems: ExpenseWithFarm[]
  initialNextCursor: number | null
  seasonId: string
  filters: ExpenseFilters
}

export function ExpenseList({
  initialItems,
  initialNextCursor,
  seasonId,
  filters,
}: ExpenseListProps) {
  const [items, setItems] = useState(initialItems)
  const [cursor, setCursor] = useState(initialNextCursor)
  const [isPending, startTransition] = useTransition()

  function handleDelete(expenseId: string) {
    if (!confirm('Delete this expense?')) return
    startTransition(async () => {
      const result = await deleteExpense(expenseId, seasonId)
      if (result.error) {
        alert(result.error)
      } else {
        setItems((prev) => prev.filter((e) => e.id !== expenseId))
      }
    })
  }

  function handleLoadMore() {
    if (cursor === null) return
    startTransition(async () => {
      const { items: more, nextCursor } = await loadMoreExpenses(
        seasonId,
        filters,
        cursor,
      )
      setItems((prev) => [...prev, ...more])
      setCursor(nextCursor)
    })
  }

  return (
    <>
      <div className="card overflow-hidden">
        <div className="list">
          {items.map((expense) => {
            const meta = CATEGORY_META[expense.category] ?? CATEGORY_META.misc
            const Icon = meta.icon
            const landlordCost = expense.landlord_cost
            const contractorCost = Math.max(0, expense.amount - landlordCost)
            const landlordPct =
              expense.amount > 0
                ? Math.round((landlordCost / expense.amount) * 100)
                : 0
            const target = expense.worker
              ? expense.worker.name
              : expense.farm_name ?? '—'
            return (
              <div
                key={expense.id}
                id={`expense-${expense.id}`}
                className="activity-row group"
                style={{
                  gridTemplateColumns:
                    '40px minmax(0,1fr) 180px 140px 48px 36px',
                }}
              >
                <div
                  className={`activity-icon ${meta.cls}`}
                  aria-hidden="true"
                >
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <div className="activity-title truncate">
                    {expense.description ?? expense.category}
                  </div>
                  <div className="activity-meta truncate">
                    {expense.category[0].toUpperCase() +
                      expense.category.slice(1)}{' '}
                    · {target} · {formatDate(expense.expense_date)}
                  </div>
                </div>
                <div className="split-cell">
                  <div className="split-bar split-bar--prominent">
                    <div
                      className="seg-landlord"
                      style={{ width: `${landlordPct}%` }}
                    />
                    <div
                      className="seg-contractor"
                      style={{ width: `${100 - landlordPct}%` }}
                    />
                  </div>
                  <div className="split-cell__caption">
                    <span className="mono tnum">{formatPKR(landlordCost)}</span>
                    <span className="muted text-[10.5px]">L · C</span>
                    <span className="mono tnum">
                      {formatPKR(contractorCost)}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="mono tnum text-[14px] font-semibold text-[color:var(--heading)]">
                    {formatPKR(expense.amount)}
                  </div>
                  <div className="mt-0.5 text-[11px] text-[color:var(--text-muted)]">
                    Landlord {landlordPct}%
                  </div>
                </div>
                <div className="flex items-center justify-center">
                  {expense.photo_path ? (
                    <PhotoThumbnailClient
                      path={expense.photo_path}
                      alt="Receipt photo"
                    />
                  ) : (
                    <div className="h-12 w-12" aria-hidden="true" />
                  )}
                </div>
                <button
                  type="button"
                  className="icon-btn opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50"
                  disabled={isPending}
                  onClick={() => handleDelete(expense.id)}
                  aria-label="Delete expense"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            )
          })}
        </div>
      </div>

      {cursor !== null && (
        <div className="mt-4 flex justify-center">
          <Button
            variant="outline"
            size="sm"
            disabled={isPending}
            onClick={handleLoadMore}
          >
            {isPending ? 'Loading…' : 'Load more'}
          </Button>
        </div>
      )}
    </>
  )
}
