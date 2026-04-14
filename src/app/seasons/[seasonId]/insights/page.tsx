import { notFound } from 'next/navigation'
import {
  getSeasonInsightsView,
  getSeasonComparison,
} from '@/lib/queries/insights-queries'
import { getSeasonById } from '@/lib/queries/season-queries'
import { createClient } from '@/lib/supabase/server'
import { SummaryCards } from '@/components/insights/summary-cards'
import { ExpenseBreakdownChart } from '@/components/insights/expense-breakdown-chart'
import { PerAcreMetrics } from '@/components/insights/per-acre-metrics'
import { SeasonComparison } from '@/components/insights/season-comparison'
import { SeasonActionButtons } from '@/components/season/season-action-buttons'

export default async function SeasonInsightsPage({
  params,
  searchParams,
}: {
  params: Promise<{ seasonId: string }>
  searchParams: Promise<{ compare?: string }>
}) {
  const { seasonId } = await params
  const { compare } = await searchParams

  const [season, view] = await Promise.all([
    getSeasonById(seasonId),
    getSeasonInsightsView(seasonId),
  ])

  if (!season || !view) {
    notFound()
  }

  // Past closed seasons (excluding current)
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

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

  return (
    <div className="space-y-6">
      {season.status === 'active' && (
        <SeasonActionButtons seasonId={seasonId} status={season.status} />
      )}

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
