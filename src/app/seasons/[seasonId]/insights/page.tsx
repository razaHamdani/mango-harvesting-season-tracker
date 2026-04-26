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
import { SeasonActionButtons } from '@/components/season/season-action-buttons'
import { PrintButton } from '@/components/insights/print-button'

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
    <div className="space-y-6">
      {/* Print-only report header */}
      <div className="print-only border-b pb-4 mb-2">
        <p className="text-sm text-gray-500">
          {profile?.full_name ?? 'AamDaata'} &mdash; {season.year} Season &mdash; Printed {new Date().toLocaleDateString('en-PK')}
        </p>
        <p className="text-xs text-gray-400">Contractor: {season.contractor_name}</p>
      </div>

      {/* Screen header: action buttons + print button */}
      <div className="flex items-center justify-between" data-print="hide">
        {season.status === 'active' && (
          <SeasonActionButtons seasonId={seasonId} status={season.status} />
        )}
        <div className="ml-auto">
          <PrintButton docTitle={docTitle} />
        </div>
      </div>

      <SummaryCards view={view} />

      <div className="grid gap-6 lg:grid-cols-2">
        <ExpenseBreakdownChart expensesByCategory={view.expensesByCategory} />
        <PerAcreMetrics view={view} />
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
