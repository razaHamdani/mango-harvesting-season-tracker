'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { CameraIcon, Trash2Icon } from 'lucide-react'
import type { ExpenseWithFarm, ExpenseFilters } from '@/lib/queries/expense-queries'
import { deleteExpense } from '@/lib/actions/expense-actions'
import { loadMoreExpenses } from '@/lib/actions/list-actions'
import { formatPKR, formatDate } from '@/lib/utils/format'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

const CATEGORY_STYLES: Record<string, string> = {
  electricity:
    'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  spray:
    'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  fertilizer:
    'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  labor:
    'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
  misc: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
}

interface ExpenseListProps {
  initialItems: ExpenseWithFarm[]
  initialNextCursor: number | null
  seasonId: string
  filters: ExpenseFilters
  totalAmount: number
  totalLandlordCost: number
}

export function ExpenseList({
  initialItems,
  initialNextCursor,
  seasonId,
  filters,
  totalAmount,
  totalLandlordCost,
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
      const { items: more, nextCursor } = await loadMoreExpenses(seasonId, filters, cursor)
      setItems((prev) => [...prev, ...more])
      setCursor(nextCursor)
    })
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Description</TableHead>
            <TableHead>Activity</TableHead>
            <TableHead className="text-right">Amount</TableHead>
            <TableHead className="text-right">Landlord Cost</TableHead>
            <TableHead>Farm</TableHead>
            <TableHead className="w-10">Receipt</TableHead>
            <TableHead className="w-10">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((expense) => (
            <TableRow key={expense.id} id={`expense-${expense.id}`}>
              <TableCell>{formatDate(expense.expense_date)}</TableCell>
              <TableCell>
                <Badge
                  className={CATEGORY_STYLES[expense.category] ?? ''}
                  variant="secondary"
                >
                  {expense.category}
                </Badge>
              </TableCell>
              <TableCell>{expense.description ?? '-'}</TableCell>
              <TableCell>
                {expense.linked_activity ? (
                  <Link
                    href={`/seasons/${seasonId}/activities#activity-${expense.linked_activity.id}`}
                    className="text-sm text-primary underline-offset-4 hover:underline"
                  >
                    {expense.linked_activity.type} · {formatDate(expense.linked_activity.activity_date)}
                  </Link>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell className="text-right">
                {formatPKR(expense.amount)}
              </TableCell>
              <TableCell className="text-right">
                {formatPKR(expense.landlord_cost)}
              </TableCell>
              <TableCell>{expense.farm_name ?? '-'}</TableCell>
              <TableCell>
                {expense.photo_path && (
                  <CameraIcon className="h-4 w-4 text-muted-foreground" />
                )}
              </TableCell>
              <TableCell>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={isPending}
                  onClick={() => handleDelete(expense.id)}
                  className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                >
                  <Trash2Icon className="h-4 w-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell colSpan={3} className="font-medium">
              Total
            </TableCell>
            <TableCell className="text-right font-medium">
              {formatPKR(totalAmount)}
            </TableCell>
            <TableCell className="text-right font-medium">
              {formatPKR(totalLandlordCost)}
            </TableCell>
            <TableCell colSpan={4} />
          </TableRow>
        </TableFooter>
      </Table>

      {cursor !== null && (
        <div className="mt-4 flex justify-center">
          <Button variant="outline" size="sm" disabled={isPending} onClick={handleLoadMore}>
            {isPending ? 'Loading…' : 'Load more'}
          </Button>
        </div>
      )}
    </>
  )
}
