'use client'

import { useTransition } from 'react'
import { CameraIcon, Trash2Icon } from 'lucide-react'
import type { ExpenseWithFarm } from '@/lib/queries/expense-queries'
import { deleteExpense } from '@/lib/actions/expense-actions'
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

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00')
  return date.toLocaleDateString('en-PK', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function formatCurrency(amount: number): string {
  return `Rs. ${amount.toLocaleString('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
}

interface ExpenseListProps {
  expenses: ExpenseWithFarm[]
  seasonId: string
}

export function ExpenseList({ expenses, seasonId }: ExpenseListProps) {
  const [isPending, startTransition] = useTransition()

  const totalLandlordCost = expenses.reduce(
    (sum, e) => sum + e.landlord_cost,
    0
  )
  const totalAmount = expenses.reduce((sum, e) => sum + e.amount, 0)

  function handleDelete(expenseId: string) {
    if (!confirm('Delete this expense?')) return
    startTransition(async () => {
      const result = await deleteExpense(expenseId, seasonId)
      if (result.error) {
        alert(result.error)
      }
    })
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Date</TableHead>
          <TableHead>Category</TableHead>
          <TableHead>Description</TableHead>
          <TableHead className="text-right">Amount</TableHead>
          <TableHead className="text-right">Landlord Cost</TableHead>
          <TableHead>Farm</TableHead>
          <TableHead className="w-10">Receipt</TableHead>
          <TableHead className="w-10">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {expenses.map((expense) => (
          <TableRow key={expense.id}>
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
            <TableCell className="text-right">
              {formatCurrency(expense.amount)}
            </TableCell>
            <TableCell className="text-right">
              {formatCurrency(expense.landlord_cost)}
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
            {formatCurrency(totalAmount)}
          </TableCell>
          <TableCell className="text-right font-medium">
            {formatCurrency(totalLandlordCost)}
          </TableCell>
          <TableCell colSpan={3} />
        </TableRow>
      </TableFooter>
    </Table>
  )
}
