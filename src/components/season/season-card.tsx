import Link from 'next/link'
import type { SeasonWithStats } from '@/lib/queries/season-queries'
import { Badge } from '@/components/ui/badge'
import { formatPKR } from '@/lib/utils/format'

const STRIPE_COLOR: Record<string, string> = {
  draft: 'var(--clay)',
  active: 'var(--mango)',
  closed: 'var(--soil)',
}

const STATUS_VARIANT: Record<string, 'draft' | 'active' | 'closed'> = {
  draft: 'draft',
  active: 'active',
  closed: 'closed',
}

const STATUS_LABEL: Record<string, string> = {
  draft: 'Draft',
  active: 'Active',
  closed: 'Closed',
}

export function SeasonCard({ season }: { season: SeasonWithStats }) {
  // SeasonWithStats doesn't carry payment / harvest data — show predetermined only.
  // Boxes / paid amounts require insights; fall back to 0 here.
  const paidPct = 0
  const boxesCollected = 0

  return (
    <Link
      href={`/seasons/${season.id}`}
      className="group block rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow)] overflow-hidden transition-[box-shadow,transform] duration-[160ms] hover:shadow-[var(--shadow-lift)] hover:-translate-y-px"
    >
      <div
        style={{ height: 4, background: STRIPE_COLOR[season.status] ?? 'var(--clay)' }}
      />
      <div className="p-5">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="min-w-0">
            <div
              className="mono"
              style={{
                fontSize: 24,
                fontWeight: 600,
                letterSpacing: '-0.02em',
                lineHeight: 1,
                color: 'var(--heading)',
              }}
            >
              {season.year}
            </div>
            <div
              className="mt-1.5 truncate"
              style={{ fontSize: 13, color: 'var(--text-muted)' }}
              title={season.contractor_name}
            >
              {season.contractor_name}
            </div>
          </div>
          <Badge variant={STATUS_VARIANT[season.status] ?? 'draft'}>
            <span className="dot" />
            {STATUS_LABEL[season.status] ?? season.status}
          </Badge>
        </div>

        <div className="mt-4">
          <div
            className="flex items-baseline justify-between"
            style={{ fontSize: 12, color: 'var(--text-muted)' }}
          >
            <span>Predetermined</span>
            <span
              className="mono"
              style={{ fontSize: 15, fontWeight: 600, color: 'var(--heading)' }}
            >
              {formatPKR(season.predetermined_amount)}
            </span>
          </div>
          <div
            className="mt-1.5 relative overflow-hidden rounded-full"
            style={{ height: 4, background: 'var(--clay-soft)' }}
          >
            <div
              className="h-full rounded-full"
              style={{ width: `${paidPct}%`, background: 'var(--mango)' }}
            />
          </div>
        </div>

        <div
          className="my-4"
          style={{ height: 1, background: 'var(--border)' }}
        />

        <div className="grid grid-cols-2 gap-3" style={{ fontSize: 12.5 }}>
          <div>
            <div style={{ color: 'var(--text-muted)' }}>Boxes</div>
            <div
              className="mono mt-0.5"
              style={{ fontWeight: 600, color: 'var(--heading)' }}
            >
              {boxesCollected}{' '}
              <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>
                / {season.agreed_boxes}
              </span>
            </div>
          </div>
          <div>
            <div style={{ color: 'var(--text-muted)' }}>Farms</div>
            <div
              className="mt-0.5"
              style={{ fontWeight: 600, color: 'var(--heading)' }}
            >
              {season.farm_count}{' '}
              <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>
                · {season.total_acreage.toFixed(1)} ac
              </span>
            </div>
          </div>
        </div>
      </div>
    </Link>
  )
}
