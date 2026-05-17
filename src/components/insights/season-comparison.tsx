'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import type { SeasonInsightsView } from '@/lib/queries/insights-queries'
import { formatPKR } from '@/lib/utils/format'

type PastSeason = { id: string; year: number }

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
      <div className="card card__pad">
        <div className="card__title">Season comparison</div>
        <p className="muted text-sm mt-2">No past seasons to compare.</p>
      </div>
    )
  }

  const comparisonYear = pastSeasons.find((s) => s.id === selectedId)?.year

  return (
    <div className="card card__pad">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <div className="card__title">Season comparison</div>
          <div className="card__sub">Year-over-year — revenue vs landlord expense</div>
        </div>
        <select
          value={selectedId}
          onChange={handleChange}
          data-print="hide"
          style={{
            height: 32,
            borderRadius: 'var(--radius-input)',
            border: '1px solid var(--border)',
            background: 'var(--surface)',
            padding: '0 10px',
            fontSize: 13,
            color: 'var(--heading)',
          }}
        >
          <option value="">Select past season…</option>
          {pastSeasons.map((s) => (
            <option key={s.id} value={s.id}>
              {s.year} Season
            </option>
          ))}
        </select>
      </div>
      {!comparisonView ? (
        <p className="muted text-sm">Select a past season to compare against.</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 20 }}>
          {([
            { year: comparisonYear, view: comparisonView },
            { year: currentYear, view: currentView },
          ] as { year: number | undefined; view: SeasonInsightsView }[]).map(({ year, view }) => {
            const rev = view.predeterminedAmount
            const exp = view.totalExpenses
            const maxBar = Math.max(rev, exp, 1)
            const profit = rev - exp
            return (
              <div key={year}>
                <div className="muted t-12 mb-2">{year}</div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'flex-end',
                    gap: 8,
                    height: 100,
                    padding: '6px 0',
                    borderBottom: '1px solid var(--border)',
                  }}
                >
                  <div
                    style={{
                      flex: 1,
                      height: `${(rev / maxBar) * 100}%`,
                      background: 'var(--mango)',
                      borderRadius: '4px 4px 0 0',
                      position: 'relative',
                      minHeight: 4,
                    }}
                  >
                    <div
                      className="mono"
                      style={{
                        position: 'absolute',
                        top: -18,
                        left: 0,
                        right: 0,
                        textAlign: 'center',
                        fontSize: 10,
                        color: 'var(--text-muted)',
                      }}
                    >
                      {(rev / 1000).toFixed(0)}k
                    </div>
                  </div>
                  <div
                    style={{
                      flex: 1,
                      height: `${(exp / maxBar) * 100}%`,
                      background: 'var(--soil)',
                      borderRadius: '4px 4px 0 0',
                      position: 'relative',
                      minHeight: 4,
                    }}
                  >
                    <div
                      className="mono"
                      style={{
                        position: 'absolute',
                        top: -18,
                        left: 0,
                        right: 0,
                        textAlign: 'center',
                        fontSize: 10,
                        color: 'var(--text-muted)',
                      }}
                    >
                      {(exp / 1000).toFixed(0)}k
                    </div>
                  </div>
                </div>
                <div
                  className="mono fw-600 mt-2"
                  style={{
                    fontSize: 13,
                    color: profit >= 0 ? 'oklch(0.45 0.13 145)' : 'var(--rust)',
                  }}
                >
                  {profit >= 0 ? '+' : ''}
                  {(profit / 1000).toFixed(0)}k profit
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
