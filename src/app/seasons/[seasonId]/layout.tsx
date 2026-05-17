import { notFound } from 'next/navigation'
import { getSeasonById } from '@/lib/queries/season-queries'
import { SeasonStatusBadge } from '@/components/season/season-status-badge'
import { SeasonTabNav } from '@/components/season/season-tab-nav'

export default async function SeasonLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ seasonId: string }>
}) {
  const { seasonId } = await params
  const season = await getSeasonById(seasonId)

  if (!season) {
    notFound()
  }

  const trackingBits = [
    season.contractor_phone,
    season.contractor_cnic ? `CNIC ${season.contractor_cnic}` : null,
  ].filter(Boolean) as string[]

  return (
    <div className="space-y-5">
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-semibold tracking-tight text-[color:var(--heading)]">
            Season {season.year}
          </h1>
          <SeasonStatusBadge status={season.status} />
        </div>
        <div className="mt-2 text-sm text-[color:var(--text-muted)]">
          <span className="font-medium text-[color:var(--heading)]">
            {season.contractor_name}
          </span>
          {trackingBits.length > 0 && (
            <>
              <span className="mx-2 text-[color:var(--text-faint)]">·</span>
              <span>{trackingBits.join(' · ')}</span>
            </>
          )}
        </div>
      </div>

      <SeasonTabNav seasonId={seasonId} />

      <div>{children}</div>
    </div>
  )
}
