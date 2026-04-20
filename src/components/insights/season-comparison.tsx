'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { SeasonInsightsView } from '@/lib/queries/insights-queries'
import { formatPKR } from '@/lib/utils/format'

type PastSeason = { id: string; year: number }

type MetricRow = {
  label: string
  value: (v: SeasonInsightsView) => string
}

const METRICS: MetricRow[] = [
  { label: 'Revenue', value: (v) => formatPKR(v.predeterminedAmount) },
  { label: 'Total Expenses', value: (v) => formatPKR(v.totalExpenses) },
  {
    label: 'Net Profit / Loss',
    value: (v) =>
      `${v.netProfit >= 0 ? '+' : '−'} ${formatPKR(Math.abs(v.netProfit))}`,
  },
  {
    label: 'Boxes Received',
    value: (v) => `${v.boxesReceived} / ${v.agreedBoxes}`,
  },
  { label: 'Total Acreage', value: (v) => `${v.totalAcreage.toFixed(2)} ac` },
  { label: 'Revenue / Acre', value: (v) => formatPKR(v.revenuePerAcre) },
  { label: 'Total Cost / Acre', value: (v) => formatPKR(v.totalCostPerAcre) },
  { label: 'Spray Cost / Acre', value: (v) => formatPKR(v.sprayCostPerAcre) },
  {
    label: 'Electricity Cost / Acre',
    value: (v) => formatPKR(v.electricityCostPerAcre),
  },
]

export function SeasonComparison({
  currentYear,
  currentView,
  comparisonView,
  pastSeasons,
}: {
  currentYear: number
  currentView: SeasonInsightsView
  comparisonView: SeasonInsightsView | null
  pastSeasons: PastSeason[]
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const selectedId = searchParams.get('compare') ?? ''

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const params = new URLSearchParams(searchParams.toString())
    if (e.target.value) {
      params.set('compare', e.target.value)
    } else {
      params.delete('compare')
    }
    router.push(`${pathname}?${params.toString()}`)
  }

  if (pastSeasons.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Season Comparison</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No past seasons to compare.
          </p>
        </CardContent>
      </Card>
    )
  }

  const comparisonYear = pastSeasons.find((s) => s.id === selectedId)?.year

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <CardTitle>Season Comparison</CardTitle>
        <select
          value={selectedId}
          onChange={handleChange}
          data-print="hide"
          className="h-8 rounded-md border border-input bg-background px-2 text-sm"
        >
          <option value="">Select past season…</option>
          {pastSeasons.map((s) => (
            <option key={s.id} value={s.id}>
              {s.year} Season
            </option>
          ))}
        </select>
      </CardHeader>
      <CardContent>
        {!comparisonView ? (
          <p className="text-sm text-muted-foreground">
            Select a past season to compare against.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Metric</TableHead>
                <TableHead>{currentYear} (Current)</TableHead>
                <TableHead>{comparisonYear}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {METRICS.map((m) => (
                <TableRow key={m.label}>
                  <TableCell className="font-medium">{m.label}</TableCell>
                  <TableCell>{m.value(currentView)}</TableCell>
                  <TableCell>{m.value(comparisonView)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}
