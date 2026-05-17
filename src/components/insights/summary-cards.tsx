import type { SeasonInsightsView } from '@/lib/queries/insights-queries'
import { formatPKR } from '@/lib/utils/format'

export function SummaryCards({ view }: { view: SeasonInsightsView }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 16 }}>
      <div className="card card__pad kpi">
        <div className="kpi__label">Predetermined amount</div>
        <div className="kpi__value">{formatPKR(view.predeterminedAmount)}</div>
        <div className="kpi__sub"><span className="tnum">{formatPKR(view.totalPaymentsReceived)}</span> received</div>
      </div>
      <div className="card card__pad kpi">
        <div className="kpi__label">Total expenses</div>
        <div className="kpi__value">{formatPKR(view.totalExpenses)}</div>
        <div className="kpi__sub">Landlord share</div>
      </div>
      <div className="card card__pad kpi">
        <div className="kpi__label">{view.netProfit >= 0 ? 'Net profit' : 'Net loss'}</div>
        <div
          className="kpi__value"
          style={{ color: view.netProfit >= 0 ? 'var(--leaf)' : 'var(--rust)' }}
        >
          {formatPKR(Math.abs(view.netProfit))}
        </div>
        <div className="kpi__sub">Revenue − Expenses</div>
      </div>
      <div className="card card__pad kpi">
        <div className="kpi__label">Boxes</div>
        <div className="kpi__value">{view.boxesReceived} / {view.agreedBoxes}</div>
        <div className="kpi__sub">Received / Agreed</div>
      </div>
    </div>
  )
}
