import Link from 'next/link'
import { listSeasons } from '@/lib/queries/season-queries'
import { getFarms } from '@/lib/queries/farm-queries'
import { SeasonCard } from '@/components/season/season-card'
import { Button } from '@/components/ui/button'

export default async function SeasonsPage() {
  const [seasons, farms] = await Promise.all([listSeasons(), getFarms()])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Seasons</h1>
          <p className="text-sm text-muted-foreground">
            Manage your mango seasons
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Button render={<Link href="/seasons/new" />}>New Season</Button>
          {farms.length === 0 && (
            <p className="text-xs text-muted-foreground">
              Add a{' '}
              <Link href="/farms" className="underline underline-offset-2 hover:text-foreground">
                farm
              </Link>{' '}
              first
            </p>
          )}
        </div>
      </div>

      {seasons.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12">
          <p className="text-muted-foreground">
            No seasons yet. Create your first mango season to get started.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {seasons.map((season) => (
            <SeasonCard key={season.id} season={season} />
          ))}
        </div>
      )}
    </div>
  )
}
