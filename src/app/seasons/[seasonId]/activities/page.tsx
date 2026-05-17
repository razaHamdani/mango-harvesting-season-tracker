import Link from 'next/link'
import { Suspense } from 'react'
import { Sprout, Plus } from 'lucide-react'
import { getActivities, getSeasonFarms } from '@/lib/queries/activity-queries'
import { ActivityFilters } from '@/components/activity/activity-filters'
import { ActivityList } from '@/components/activity/activity-list'
import { EmptyState } from '@/components/shared/empty-state'
import { buttonVariants } from '@/components/ui/button'

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

  // Unfiltered fetch is reused as the chip count source.
  const [{ items: activities, nextCursor }, farms, all] = await Promise.all([
    getActivities(seasonId, filters),
    getSeasonFarms(seasonId),
    getActivities(seasonId),
  ])

  const counts: Record<string, number> = {}
  for (const a of all.items) counts[a.type] = (counts[a.type] ?? 0) + 1

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold tracking-tight text-[color:var(--heading)]">
          Activities
        </h2>
        <Link
          href={`/seasons/${seasonId}/activities/new`}
          className={buttonVariants({ size: 'sm' })}
        >
          <Plus className="h-4 w-4" />
          Add activity
        </Link>
      </div>

      <Suspense>
        <ActivityFilters farms={farms} counts={counts} />
      </Suspense>

      {activities.length === 0 ? (
        <EmptyState
          icon={<Sprout />}
          title="No activities logged yet"
          description="Track sprays, water, fertilizer and harvest as the season progresses."
          action={
            <Link
              href={`/seasons/${seasonId}/activities/new`}
              className={buttonVariants({ size: 'sm' })}
            >
              Log first activity
            </Link>
          }
        />
      ) : (
        <ActivityList
          key={JSON.stringify(filters)}
          initialItems={activities}
          initialNextCursor={nextCursor}
          seasonId={seasonId}
          filters={filters}
        />
      )}
    </div>
  )
}
