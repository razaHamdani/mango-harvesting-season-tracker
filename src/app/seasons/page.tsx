import Link from 'next/link'
import { Plus } from 'lucide-react'
import { listSeasons } from '@/lib/queries/season-queries'
import { getFarms } from '@/lib/queries/farm-queries'
import { SeasonCard } from '@/components/season/season-card'

export default async function SeasonsPage() {
  const [seasons, farms] = await Promise.all([listSeasons(), getFarms()])

  const counts = seasons.reduce(
    (acc, s) => {
      if (s.status === 'active') acc.active += 1
      else if (s.status === 'closed') acc.closed += 1
      else if (s.status === 'draft') acc.draft += 1
      return acc
    },
    { active: 0, closed: 0, draft: 0 },
  )

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1
            style={{
              fontSize: 24,
              fontWeight: 600,
              letterSpacing: '-0.02em',
              color: 'var(--heading)',
            }}
          >
            Seasons
          </h1>
          <p
            className="mt-1.5"
            style={{ fontSize: 13, color: 'var(--text-muted)' }}
          >
            {counts.active} active · {counts.closed} closed · {counts.draft} draft
          </p>
        </div>
        {farms.length === 0 && (
          <p
            className="text-xs"
            style={{ color: 'var(--text-muted)' }}
          >
            Add a{' '}
            <Link
              href="/farms"
              className="underline underline-offset-2 hover:text-foreground"
            >
              farm
            </Link>{' '}
            first
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {seasons.map((season) => (
          <SeasonCard key={season.id} season={season} />
        ))}

        <Link
          href="/seasons/new"
          className="group flex flex-col items-center justify-center text-center transition-colors duration-[120ms]"
          style={{
            border: '1.5px dashed var(--border-strong)',
            borderRadius: 'var(--radius-card)',
            padding: '40px 24px',
            minHeight: 240,
            color: 'var(--text-muted)',
            background: 'transparent',
          }}
        >
          <div
            className="mb-3.5 grid place-items-center"
            style={{
              width: 48,
              height: 48,
              borderRadius: 999,
              background: 'var(--clay-soft)',
              color: 'var(--soil)',
            }}
          >
            <Plus size={22} />
          </div>
          <div
            style={{
              fontSize: 14,
              fontWeight: 500,
              color: 'var(--soil)',
            }}
          >
            Start a new season
          </div>
          <div
            className="mt-1"
            style={{ fontSize: 12, color: 'var(--text-muted)' }}
          >
            Draft contract · pick farms · set installments
          </div>
        </Link>
      </div>
    </div>
  )
}
