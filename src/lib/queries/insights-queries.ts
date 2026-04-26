import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from './_user-context'

type RawInsights = {
  predetermined_amount: number
  total_acreage: number
  agreed_boxes: number
  boxes_received: number
  total_expenses: number
  expenses_by_category: Record<string, number>
  total_payments_received: number
  installments_paid: number
  installments_total: number
}

export type SeasonInsightsView = {
  seasonId: string
  predeterminedAmount: number
  totalAcreage: number
  agreedBoxes: number
  boxesReceived: number
  totalExpenses: number
  expensesByCategory: Record<string, number>
  totalPaymentsReceived: number
  installmentsPaid: number
  installmentsTotal: number
  // Derived
  netProfit: number
  totalCostPerAcre: number
  revenuePerAcre: number
  sprayCostPerAcre: number
  electricityCostPerAcre: number
}

function deriveMetrics(
  seasonId: string,
  raw: RawInsights
): SeasonInsightsView {
  const acreage = raw.total_acreage || 0
  const safe = (numerator: number) => (acreage > 0 ? numerator / acreage : 0)
  const byCat = raw.expenses_by_category ?? {}

  return {
    seasonId,
    predeterminedAmount: raw.predetermined_amount,
    totalAcreage: acreage,
    agreedBoxes: raw.agreed_boxes,
    boxesReceived: raw.boxes_received,
    totalExpenses: raw.total_expenses,
    expensesByCategory: byCat,
    totalPaymentsReceived: raw.total_payments_received,
    installmentsPaid: raw.installments_paid,
    installmentsTotal: raw.installments_total,
    netProfit: raw.predetermined_amount - raw.total_expenses,
    totalCostPerAcre: safe(raw.total_expenses),
    revenuePerAcre: safe(raw.predetermined_amount),
    sprayCostPerAcre: safe(byCat.spray ?? 0),
    electricityCostPerAcre: safe(byCat.electricity ?? 0),
  }
}

export async function getSeasonInsightsView(
  seasonId: string
): Promise<SeasonInsightsView | null> {
  const user = await getCurrentUser()
  if (!user) return null

  const supabase = await createClient()

  // Ownership check (defense-in-depth: RPC also guards via auth.uid())
  const { data: season } = await supabase
    .from('seasons')
    .select('id')
    .eq('id', seasonId)
    .eq('owner_id', user.id)
    .single()
  if (!season) return null

  const { data, error } = await supabase.rpc('get_season_insights', {
    p_season_id: seasonId,
  })
  if (error || !data) return null

  return deriveMetrics(seasonId, data as unknown as RawInsights)
}

export async function getSeasonComparison(
  seasonIds: string[]
): Promise<SeasonInsightsView[]> {
  const capped = seasonIds.slice(0, 3)
  if (capped.length === 0) return []

  // One auth call (cached by getCurrentUser), one batch ownership check,
  // then all RPC calls in parallel — 4 round-trips max vs previous N*3.
  const user = await getCurrentUser()
  if (!user) return []

  const supabase = await createClient()

  const { data: owned } = await supabase
    .from('seasons')
    .select('id')
    .in('id', capped)
    .eq('owner_id', user.id)

  const ownedIds = new Set((owned ?? []).map((s) => s.id))

  const results = await Promise.all(
    capped
      .filter((id) => ownedIds.has(id))
      .map(async (id) => {
        const { data, error } = await supabase.rpc('get_season_insights', {
          p_season_id: id,
        })
        if (error || !data) return null
        return deriveMetrics(id, data as unknown as RawInsights)
      })
  )

  return results.filter((r): r is SeasonInsightsView => r !== null)
}
