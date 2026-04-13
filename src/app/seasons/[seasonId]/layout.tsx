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

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold">
          {season.year} Season
        </h1>
        <SeasonStatusBadge status={season.status} />
        <span className="text-muted-foreground">
          {season.contractor_name}
        </span>
      </div>
      <SeasonTabNav seasonId={seasonId} />
      <div>{children}</div>
    </div>
  )
}
