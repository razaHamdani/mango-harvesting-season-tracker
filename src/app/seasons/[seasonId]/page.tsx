import { notFound } from 'next/navigation'
import { Home } from 'lucide-react'
import { getSeasonById, getSeasonInsights } from '@/lib/queries/season-queries'
import { DutySplitDisplay } from '@/components/season/duty-split-display'
import { SeasonActionButtons } from '@/components/season/season-action-buttons'
import { formatPKR } from '@/lib/utils/format'
import { summarizeInstallments } from '@/lib/utils/installment-shortfall'

export default async function SeasonOverviewPage({
  params,
}: {
  params: Promise<{ seasonId: string }>
}) {
  const { seasonId } = await params
  const [season, insights] = await Promise.all([
    getSeasonById(seasonId),
    getSeasonInsights(seasonId),
  ])

  if (!season) {
    notFound()
  }

  const predetermined = season.predetermined_amount
  const received = insights?.total_payments_received ?? 0
  const receivedPct =
    predetermined > 0 ? Math.round((received / predetermined) * 100) : 0
  const agreedBoxes = season.agreed_boxes
  const collectedBoxes = season.boxes_received
  const boxPct =
    agreedBoxes > 0 ? Math.round((collectedBoxes / agreedBoxes) * 100) : 0

  // Drives the close-confirm warning. Derived from installment rows (already
  // fetched by getSeasonById) — the insights RPC can't see underpayment.
  const shortfall = summarizeInstallments(season.installments)

  return (
    <div className="flex flex-col gap-6">
      <SeasonActionButtons
        seasonId={season.id}
        status={season.status}
        shortfall={shortfall}
      />

      {/* KPI strip */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <div className="kpi">
          <div className="kpi__label">Predetermined</div>
          <div className="kpi__value">{formatPKR(predetermined)}</div>
        </div>
        <div className="kpi">
          <div className="kpi__label">Received</div>
          <div className="kpi__value">{formatPKR(received)}</div>
          <div className="kpi__sub">({receivedPct}%) of contract</div>
        </div>
        <div className="kpi">
          <div className="kpi__label">Agreed boxes</div>
          <div className="kpi__value">{agreedBoxes}</div>
        </div>
        <div className="kpi">
          <div className="kpi__label">Collected boxes</div>
          <div className="kpi__value">{collectedBoxes}</div>
          <div className="kpi__sub">({boxPct}%) of agreed</div>
        </div>
      </div>

      {/* 60/40 grid */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <DutySplitDisplay
          sprayLandlordPct={season.spray_landlord_pct}
          fertilizerLandlordPct={season.fertilizer_landlord_pct}
          expensesByCategory={insights?.expenses_by_category ?? {}}
        />

        <div className="card">
          <div className="px-6 pt-5 pb-2">
            <div className="card__title">Farms</div>
            <div className="card__sub">
              {season.farms.length} farms · {season.total_acreage.toFixed(2)} acres
            </div>
          </div>
          <div className="pb-2">
            {season.farms.length === 0 ? (
              <p className="px-6 py-4 text-sm text-[color:var(--text-muted)]">
                No farms assigned.
              </p>
            ) : (
              season.farms.map((farm, i) => (
                <div
                  key={farm.id}
                  className="flex items-center justify-between px-6 py-3"
                  style={{
                    borderTop:
                      i === 0 ? '0' : '1px solid var(--border)',
                  }}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="grid place-items-center rounded-full"
                      style={{
                        width: 36,
                        height: 36,
                        background: 'var(--leaf-soft)',
                        color: 'oklch(0.35 0.13 145)',
                      }}
                      aria-hidden="true"
                    >
                      <Home className="h-4 w-4" />
                    </span>
                    <div>
                      <div className="text-[13.5px] font-medium text-[color:var(--heading)]">
                        {farm.name}
                      </div>
                      <div className="text-xs text-[color:var(--text-muted)] mt-0.5">
                        {farm.acreage} acres
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
