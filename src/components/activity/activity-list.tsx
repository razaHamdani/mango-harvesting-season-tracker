'use client'

import { useTransition } from 'react'
import { CameraIcon, Trash2Icon } from 'lucide-react'
import type { ActivityWithFarm } from '@/lib/queries/activity-queries'
import { deleteActivity } from '@/lib/actions/activity-actions'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

const TYPE_STYLES: Record<string, string> = {
  spray: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  water: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  fertilize: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  harvest: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00')
  return date.toLocaleDateString('en-PK', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function getDetails(activity: ActivityWithFarm): string {
  switch (activity.type) {
    case 'spray':
    case 'fertilize':
      return activity.item_name ?? '-'
    case 'water':
      return activity.meter_reading != null
        ? `Meter: ${activity.meter_reading}`
        : '-'
    case 'harvest':
      return activity.boxes_collected != null
        ? `${activity.boxes_collected} boxes`
        : '-'
    default:
      return '-'
  }
}

interface ActivityListProps {
  activities: ActivityWithFarm[]
  seasonId: string
}

export function ActivityList({ activities, seasonId }: ActivityListProps) {
  const [isPending, startTransition] = useTransition()

  function handleDelete(activityId: string) {
    if (!confirm('Delete this activity?')) return
    startTransition(async () => {
      const result = await deleteActivity(activityId, seasonId)
      if (result.error) {
        alert(result.error)
      }
    })
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Date</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Farm</TableHead>
          <TableHead>Details</TableHead>
          <TableHead className="w-10">Photo</TableHead>
          <TableHead className="w-10">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {activities.map((activity) => (
          <TableRow key={activity.id}>
            <TableCell>{formatDate(activity.activity_date)}</TableCell>
            <TableCell>
              <Badge
                className={TYPE_STYLES[activity.type] ?? ''}
                variant="secondary"
              >
                {activity.type}
              </Badge>
            </TableCell>
            <TableCell>{activity.farm_name}</TableCell>
            <TableCell>{getDetails(activity)}</TableCell>
            <TableCell>
              {activity.photo_path && (
                <CameraIcon className="h-4 w-4 text-muted-foreground" />
              )}
            </TableCell>
            <TableCell>
              <Button
                variant="ghost"
                size="sm"
                disabled={isPending}
                onClick={() => handleDelete(activity.id)}
                className="h-8 w-8 p-0 text-destructive hover:text-destructive"
              >
                <Trash2Icon className="h-4 w-4" />
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
