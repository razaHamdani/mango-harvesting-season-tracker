import Link from 'next/link'
import { Suspense } from 'react'
import { getActivities, getSeasonFarms } from '@/lib/queries/activity-queries'
import { ActivityFilters } from '@/components/activity/activity-filters'
import { ActivityList } from '@/components/activity/activity-list'
import { Button } from '@/components/ui/button'

export default async function ActivitiesPage({
  params,
  searchParams,
}: {
  params: Promise<{ seasonId: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { seasonId } = await params
  const sp = await searchParams

  const filters = {
    type: typeof sp.type === 'string' ? sp.type : undefined,
    farmId: typeof sp.farmId === 'string' ? sp.farmId : undefined,
    dateFrom: typeof sp.dateFrom === 'string' ? sp.dateFrom : undefined,
    dateTo: typeof sp.dateTo === 'string' ? sp.dateTo : undefined,
  }

  const [{ items: activities, nextCursor }, farms] = await Promise.all([
    getActivities(seasonId, filters),
    getSeasonFarms(seasonId),
  ])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Activities</h2>
        <Button size="sm" render={<Link href={`/seasons/${seasonId}/activities/new`} />}>
          Log Activity
        </Button>
      </div>

      <Suspense>
        <ActivityFilters farms={farms} />
      </Suspense>

      {activities.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <p className="text-sm text-muted-foreground">
            No activities logged yet.
          </p>
          <Button variant="link" size="sm" className="mt-2" render={<Link href={`/seasons/${seasonId}/activities/new`} />}>
            Log your first activity
          </Button>
        </div>
      ) : (
        <ActivityList
          initialItems={activities}
          initialNextCursor={nextCursor}
          seasonId={seasonId}
          filters={filters}
        />
      )}
    </div>
  )
}
