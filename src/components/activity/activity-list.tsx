'use client'

import { useState, useTransition } from 'react'
import { Sparkles, Droplet, Leaf, Package, Trash2 } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type {
  ActivityWithFarm,
  ActivityFilters,
} from '@/lib/queries/activity-queries'
import { PhotoThumbnailClient } from '@/components/photo/photo-thumbnail-client'
import { deleteActivity } from '@/lib/actions/activity-actions'
import { loadMoreActivities } from '@/lib/actions/list-actions'
import { formatDate } from '@/lib/utils/format'
import { Button } from '@/components/ui/button'

const TYPE_META: Record<
  string,
  { icon: LucideIcon; cls: 'spray' | 'water' | 'fertilize' | 'harvest' }
> = {
  spray: { icon: Sparkles, cls: 'spray' },
  water: { icon: Droplet, cls: 'water' },
  fertilize: { icon: Leaf, cls: 'fertilize' },
  harvest: { icon: Package, cls: 'harvest' },
}

function describe(activity: ActivityWithFarm): {
  title: string
  quantity: string
} {
  switch (activity.type) {
    case 'spray':
      return {
        title: activity.item_name
          ? `Spray — ${activity.item_name}`
          : 'Spray',
        quantity: '',
      }
    case 'fertilize':
      return {
        title: activity.item_name
          ? `Fertilize — ${activity.item_name}`
          : 'Fertilize',
        quantity: '',
      }
    case 'water':
      return {
        title: 'Water',
        quantity:
          activity.meter_reading != null
            ? `${activity.meter_reading} m³`
            : '',
      }
    case 'harvest':
      return {
        title: 'Harvest',
        quantity:
          activity.boxes_collected != null
            ? `${activity.boxes_collected} boxes`
            : '',
      }
    default:
      return { title: activity.type, quantity: '' }
  }
}

interface ActivityListProps {
  initialItems: ActivityWithFarm[]
  initialNextCursor: number | null
  seasonId: string
  filters: ActivityFilters
}

export function ActivityList({
  initialItems,
  initialNextCursor,
  seasonId,
  filters,
}: ActivityListProps) {
  const [items, setItems] = useState(initialItems)
  const [cursor, setCursor] = useState(initialNextCursor)
  const [isPending, startTransition] = useTransition()

  function handleDelete(activityId: string) {
    if (!confirm('Delete this activity?')) return
    startTransition(async () => {
      const result = await deleteActivity(activityId, seasonId)
      if (result.error) {
        alert(result.error)
      } else {
        setItems((prev) => prev.filter((a) => a.id !== activityId))
      }
    })
  }

  function handleLoadMore() {
    if (cursor === null) return
    startTransition(async () => {
      const { items: more, nextCursor } = await loadMoreActivities(
        seasonId,
        filters,
        cursor,
      )
      setItems((prev) => [...prev, ...more])
      setCursor(nextCursor)
    })
  }

  return (
    <>
      <div className="card overflow-hidden">
        <div className="list">
          {items.map((activity) => {
            const meta = TYPE_META[activity.type] ?? TYPE_META.spray
            const Icon = meta.icon
            const { title, quantity } = describe(activity)
            return (
              <div
                key={activity.id}
                id={`activity-${activity.id}`}
                className="activity-row group"
                style={{
                  gridTemplateColumns:
                    '40px minmax(0,1fr) 110px 48px 36px',
                }}
              >
                <div
                  className={`activity-icon ${meta.cls}`}
                  aria-hidden="true"
                >
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <div className="activity-title truncate">{title}</div>
                  <div className="activity-meta truncate">
                    {activity.farm_name} ·{' '}
                    {formatDate(activity.activity_date)}
                  </div>
                </div>
                <div className="mono tnum text-right text-[13px] text-[color:var(--heading)]">
                  {quantity}
                </div>
                <div className="flex items-center justify-center">
                  {activity.photo_path ? (
                    <PhotoThumbnailClient
                      path={activity.photo_path}
                      alt="Activity photo"
                    />
                  ) : (
                    <div className="h-12 w-12" aria-hidden="true" />
                  )}
                </div>
                <button
                  type="button"
                  className="icon-btn opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50"
                  disabled={isPending}
                  onClick={() => handleDelete(activity.id)}
                  aria-label="Delete activity"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            )
          })}
        </div>
      </div>

      {cursor !== null && (
        <div className="mt-4 flex justify-center">
          <Button
            variant="outline"
            size="sm"
            disabled={isPending}
            onClick={handleLoadMore}
          >
            {isPending ? 'Loading…' : 'Load more'}
          </Button>
        </div>
      )}
    </>
  )
}
