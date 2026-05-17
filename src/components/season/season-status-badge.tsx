import type { SeasonStatus } from '@/types/database'

const labels: Record<SeasonStatus, string> = {
  draft: 'Draft',
  active: 'Active',
  closed: 'Closed',
}

export function SeasonStatusBadge({ status }: { status: SeasonStatus }) {
  return (
    <span className={`badge badge--${status}`}>
      <span className="dot" aria-hidden="true" />
      {labels[status]}
    </span>
  )
}
