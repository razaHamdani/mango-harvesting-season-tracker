import type { SeasonInsightsView } from '@/lib/queries/insights-queries'
import { formatPKR } from '@/lib/utils/format'

export function PerAcreMetrics({ view }: { view: SeasonInsightsView }) {
  if (view.totalAcreage <= 0) {
    return (
      <div className="card card__pad">
        <div className="card__title">Per-acre metrics</div>
        <p className="muted text-sm mt-2">
          Add farms to this season to see per-acre metrics.
        </p>
      </div>
    )
  }

  const items = [
    { label: 'Revenue / Acre', value: view.revenuePerAcre },
    { label: 'Total Cost / Acre', value: view.totalCostPerAcre },
    { label: 'Spray Cost / Acre', value: view.sprayCostPerAcre },
    { label: 'Electricity / Acre', value: view.electricityCostPerAcre },
    { label: 'Fertilizer Cost / Acre', value: view.fertilizerCostPerAcre },
    { label: 'Labor Cost / Acre', value: view.laborCostPerAcre },
    { label: 'Misc Cost / Acre', value: view.miscCostPerAcre },
  ]

  return (
    <div className="card card__pad">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
        <div>
          <div className="card__title">Per-acre metrics</div>
          <div className="card__sub">
            Based on {view.totalAcreage.toFixed(2)} total acres
          </div>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 20 }}>
        {items.map((p) => (
          <div key={p.label} className="kpi">
            <div className="kpi__label">{p.label}</div>
            <div className="kpi__value">{formatPKR(p.value)}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
