import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import type { SeasonInsightsView } from '@/lib/queries/insights-queries'
import { formatPKR } from '@/lib/utils/format'

export function PerAcreMetrics({ view }: { view: SeasonInsightsView }) {
  if (view.totalAcreage <= 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Per-Acre Metrics</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Add farms to this season to see per-acre metrics.
          </p>
        </CardContent>
      </Card>
    )
  }

  const items = [
    { label: 'Revenue / Acre', value: view.revenuePerAcre },
    { label: 'Total Cost / Acre', value: view.totalCostPerAcre },
    { label: 'Spray Cost / Acre', value: view.sprayCostPerAcre },
    { label: 'Electricity Cost / Acre', value: view.electricityCostPerAcre },
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle>Per-Acre Metrics</CardTitle>
        <p className="text-xs text-muted-foreground">
          Based on {view.totalAcreage.toFixed(2)} total acres
        </p>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((item) => (
          <div key={item.label} className="space-y-1">
            <p className="text-xs text-muted-foreground">{item.label}</p>
            <p className="text-lg font-semibold">{formatPKR(item.value)}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
