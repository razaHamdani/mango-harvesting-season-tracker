import { Sparkles, Leaf, Zap, User, Package } from 'lucide-react'
import type { ReactNode } from 'react'
import { formatPKR, formatDate } from '@/lib/utils/format'

type Row = {
  key: 'spray' | 'fertilizer' | 'electricity' | 'labor' | 'misc'
  label: string
  icon: ReactNode
  iconClass: string
  total: number
  landlordPct: number
}

interface DutySplitDisplayProps {
  sprayLandlordPct: number
  fertilizerLandlordPct: number
  expensesByCategory: Record<string, number>
}

export function DutySplitDisplay({
  sprayLandlordPct,
  fertilizerLandlordPct,
  expensesByCategory,
}: DutySplitDisplayProps) {
  const cat = (k: string) => expensesByCategory[k] ?? 0

  const rows: Row[] = [
    {
      key: 'spray',
      label: 'Spray',
      icon: <Sparkles className="h-3.5 w-3.5" />,
      iconClass: 'spray',
      total: cat('spray'),
      landlordPct: sprayLandlordPct,
    },
    {
      key: 'fertilizer',
      label: 'Fertilizer',
      icon: <Leaf className="h-3.5 w-3.5" />,
      iconClass: 'fertilize',
      total: cat('fertilizer'),
      landlordPct: fertilizerLandlordPct,
    },
    {
      key: 'electricity',
      label: 'Electricity',
      icon: <Zap className="h-3.5 w-3.5" />,
      iconClass: 'expense',
      total: cat('electricity'),
      landlordPct: 100,
    },
    {
      key: 'labor',
      label: 'Labor',
      icon: <User className="h-3.5 w-3.5" />,
      iconClass: 'expense',
      total: cat('labor'),
      landlordPct: 100,
    },
    {
      key: 'misc',
      label: 'Misc',
      icon: <Package className="h-3.5 w-3.5" />,
      iconClass: 'expense',
      total: cat('misc'),
      landlordPct: 100,
    },
  ]

  const landlordTotal = rows.reduce(
    (s, r) => s + (r.total * r.landlordPct) / 100,
    0,
  )
  const contractorTotal = rows.reduce(
    (s, r) => s + (r.total * (100 - r.landlordPct)) / 100,
    0,
  )

  const today = formatDate(new Date())

  return (
    <div className="card card__pad">
      <div className="flex items-start justify-between mb-5">
        <div>
          <div className="card__title">Duty split — Who pays what</div>
          <div className="card__sub">Through {today}</div>
        </div>
      </div>

      <div className="flex flex-col gap-5">
        {rows.map((r) => {
          const landlordAmt = (r.total * r.landlordPct) / 100
          const contractorAmt = r.total - landlordAmt
          return (
            <div key={r.key}>
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2.5">
                  <span
                    className={`activity-icon ${r.iconClass}`}
                    style={{ width: 28, height: 28 }}
                    aria-hidden="true"
                  >
                    {r.icon}
                  </span>
                  <span className="text-[13px] font-medium text-[color:var(--heading)]">
                    {r.label}
                  </span>
                </div>
                <span className="mono tnum text-xs text-[color:var(--text-muted)]">
                  {formatPKR(r.total)} total
                </span>
              </div>
              <div className="split-bar split-bar--prominent">
                <div
                  className="seg-landlord"
                  style={{ width: `${r.landlordPct}%` }}
                />
                <div
                  className="seg-contractor"
                  style={{ width: `${100 - r.landlordPct}%` }}
                />
              </div>
              <div className="flex justify-between mt-1.5 text-[11.5px] text-[color:var(--text-muted)]">
                <span>
                  Landlord {r.landlordPct}% ·{' '}
                  <span className="mono tnum text-[color:var(--heading)]">
                    {formatPKR(landlordAmt)}
                  </span>
                </span>
                <span>
                  Contractor {100 - r.landlordPct}% ·{' '}
                  <span className="mono tnum text-[color:var(--heading)]">
                    {formatPKR(contractorAmt)}
                  </span>
                </span>
              </div>
            </div>
          )
        })}
      </div>

      <div className="divider my-5" />

      <div className="flex justify-between">
        <div>
          <div className="section-label">Landlord share to date</div>
          <div className="mono tnum mt-1 text-[22px] font-semibold text-[color:var(--heading)]">
            {formatPKR(landlordTotal)}
          </div>
        </div>
        <div className="text-right">
          <div className="section-label">Contractor share to date</div>
          <div className="mono tnum mt-1 text-[22px] font-semibold text-[color:var(--heading)]">
            {formatPKR(contractorTotal)}
          </div>
        </div>
      </div>
    </div>
  )
}
