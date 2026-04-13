import type { SeasonStatus } from '@/types/database'
import { Badge } from '@/components/ui/badge'

const statusConfig: Record<
  SeasonStatus,
  { label: string; className: string }
> = {
  draft: {
    label: 'Draft',
    className: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400',
  },
  active: {
    label: 'Active',
    className:
      'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  },
  closed: {
    label: 'Closed',
    className:
      'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  },
}

export function SeasonStatusBadge({ status }: { status: SeasonStatus }) {
  const config = statusConfig[status]
  return <Badge className={config.className}>{config.label}</Badge>
}
