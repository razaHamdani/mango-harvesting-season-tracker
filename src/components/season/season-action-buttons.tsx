'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { activateSeason, closeSeason, deleteSeason } from '@/lib/actions/season-actions'
import type { SeasonStatus } from '@/types/database'

export function SeasonActionButtons({
  seasonId,
  status,
}: {
  seasonId: string
  status: SeasonStatus
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function handleActivate() {
    startTransition(async () => {
      const result = await activateSeason(seasonId)
      if (result.error) {
        alert(result.error._form?.join(', ') ?? 'Failed to activate season.')
      }
    })
  }

  function handleClose() {
    if (!confirm('Are you sure you want to close this season? This cannot be undone.')) {
      return
    }
    startTransition(async () => {
      const result = await closeSeason(seasonId)
      if (result.error) {
        alert(result.error._form?.join(', ') ?? 'Failed to close season.')
      }
    })
  }

  function handleDelete() {
    if (!confirm('Are you sure you want to delete this draft season? This cannot be undone.')) {
      return
    }
    startTransition(async () => {
      const result = await deleteSeason(seasonId)
      if (result.error) {
        alert(result.error._form?.join(', ') ?? 'Failed to delete season.')
      } else {
        router.push('/seasons')
      }
    })
  }

  if (status === 'closed') {
    return null
  }

  return (
    <div className="flex gap-2">
      {status === 'draft' && (
        <>
          <Button onClick={handleActivate} disabled={isPending}>
            Activate Season
          </Button>
          <Button variant="destructive" onClick={handleDelete} disabled={isPending}>
            Delete Season
          </Button>
        </>
      )}
      {status === 'active' && (
        <Button variant="outline" onClick={handleClose} disabled={isPending}>
          Close Season
        </Button>
      )}
    </div>
  )
}
