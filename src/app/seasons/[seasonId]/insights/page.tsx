import { notFound } from 'next/navigation'
import {
  getSeasonInsightsView,
  getSeasonComparison,
} from '@/lib/queries/insights-queries'
import { getSeasonById } from '@/lib/queries/season-queries'
import { getCurrentProfile } from '@/lib/queries/profile-queries'
import { getCurrentUser } from '@/lib/queries/_user-context'
import { createClient } from '@/lib/supabase/server'
import { SummaryCards } from '@/components/insights/summary-cards'
import { ExpenseBreakdownChart } from '@/components/insights/expense-breakdown-chart'
import { PerAcreMetrics } from '@/components/insights/per-acre-metrics'
import { SeasonComparison } from '@/components/insights/season-comparison'
import { NetProfitGauge } from '@/components/insights/net-profit-gauge'
import { SeasonActionButtons } from '@/components/season/season-action-buttons'
import { summarizeInstallments } from '@/lib/utils/installment-shortfall'
import { PrintButton } from '@/components/insights/print-button'
import { formatPKR } from '@/lib/utils/format'

export default async function SeasonInsightsPage({
  params,
  searchParams,
}: {
  params: Promise<{ seasonId: string }>
  searchParams: Promise<{ compare?: string }>
}) {
  const { seasonId } = await params
  const { compare } = await searchParams

  const [season, view, profile] = await Promise.all([
    getSeasonById(seasonId),
    getSeasonInsightsView(seasonId),
    getCurrentProfile(),
  ])

  if (!season || !view) {
    notFound()
  }

  // Past closed seasons (excluding current) — user already verified via getSeasonById above.
  const user = await getCurrentUser()
  const supabase = await createClient()

  let pastSeasons: { id: string; year: number }[] = []
  if (user) {
    const { data } = await supabase
      .from('seasons')
      .select('id, year')
      .eq('owner_id', user.id)
      .eq('status', 'closed')
      .neq('id', seasonId)
      .order('year', { ascending: false })
    pastSeasons = data ?? []
  }

  const comparisonResults =
    compare && pastSeasons.some((s) => s.id === compare)
      ? await getSeasonComparison([compare])
      : []
  const comparisonView = comparisonResults[0] ?? null

  const docTitle = `Insights-${season.year}-${season.contractor_name.replace(/\s+/g, '-')}.pdf`

  return (
    <div className="flex flex-col gap-6 mt-6">
      {/* Print-only report header */}
      <div className="print-only border-b pb-4 mb-2">
        <p className="text-sm text-[color:var(--text-muted)]">
          {profile?.full_name ?? 'AamDaata'} &mdash; {season.year} Season &mdash; Printed {new Date().toLocaleDateString('en-PK')}
        </p>
        <p className="text-xs muted">Contractor: {season.contractor_name}</p>
      </div>

      {/* Screen header: action buttons + print button */}
      <div className="flex items-center justify-between" data-print="hide">
        {season.status === 'active' && (
          <SeasonActionButtons
            seasonId={seasonId}
            status={season.status}
            shortfall={summarizeInstallments(season.installments)}
          />
        )}
        <div className="ml-auto">
          <PrintButton docTitle={docTitle} />
        </div>
      </div>

      <SummaryCards view={view} />

      <PerAcreMetrics view={view} />

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.3fr) minmax(0,1fr)', gap: 24 }}>
        <ExpenseBreakdownChart expensesByCategory={view.expensesByCategory} />

        {/* Net profit card */}
        <div className="card card__pad">
          <div className="card__title">Net profit</div>
          <div className="card__sub mb-4">Revenue − landlord expenses</div>
          <NetProfitGauge revenue={view.totalPaymentsReceived} expenses={view.totalExpenses} />
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 14, marginTop: 24, paddingTop: 18, borderTop: '1px solid var(--border)' }}>
            <div>
              <div className="section-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: 999, background: 'var(--mango)', display: 'inline-block' }} />
                Revenue
              </div>
              <div className="mono" style={{ fontSize: 15, fontWeight: 600, marginTop: 4, color: 'var(--heading)' }}>{formatPKR(view.totalPaymentsReceived)}</div>
            </div>
            <div>
              <div className="section-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: 999, background: 'var(--rust)', display: 'inline-block' }} />
                Expenses
              </div>
              <div className="mono" style={{ fontSize: 15, fontWeight: 600, marginTop: 4, color: 'var(--heading)' }}>{formatPKR(view.totalExpenses)}</div>
            </div>
          </div>
        </div>
      </div>

      <SeasonComparison
        currentYear={season.year}
        currentView={view}
        comparisonView={comparisonView}
        pastSeasons={pastSeasons}
      />
    </div>
  )
}
