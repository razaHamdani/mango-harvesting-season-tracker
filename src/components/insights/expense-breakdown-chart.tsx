'use client'

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { formatPKR } from '@/lib/utils/format'

const CATEGORIES = ['electricity', 'spray', 'fertilizer', 'labor', 'misc']

export function ExpenseBreakdownChart({
  expensesByCategory,
}: {
  expensesByCategory: Record<string, number>
}) {
  const data = CATEGORIES.map((cat) => ({
    category: cat.charAt(0).toUpperCase() + cat.slice(1),
    amount: expensesByCategory[cat] ?? 0,
  }))

  const hasData = data.some((d) => d.amount > 0)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Expense Breakdown</CardTitle>
      </CardHeader>
      <CardContent>
        {!hasData ? (
          <p className="text-sm text-muted-foreground">
            No expenses recorded yet.
          </p>
        ) : (
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="category"
                  tick={{ fontSize: 12 }}
                  className="fill-muted-foreground"
                />
                <YAxis
                  tick={{ fontSize: 12 }}
                  tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                  className="fill-muted-foreground"
                />
                <Tooltip
                  formatter={(v) => formatPKR(Number(v ?? 0))}
                  contentStyle={{
                    background: 'hsl(var(--background))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Bar
                  dataKey="amount"
                  fill="#3b82f6"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
