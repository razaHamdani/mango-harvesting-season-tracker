'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { activateSeason, closeSeason, deleteSeason } from '@/lib/actions/season-actions'
import { buildCloseWarning, type InstallmentSummary } from '@/lib/utils/installment-shortfall'
import type { SeasonStatus } from '@/types/database'

export function SeasonActionButtons({
  seasonId,
  status,
  shortfall,
}: {
  seasonId: string
  status: SeasonStatus
  /** Unpaid/underpaid summary, shown in the close confirmation. Server-computed. */
  shortfall?: InstallmentSummary
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
    // Surface unpaid/underpaid installments BEFORE the close — closing is
    // permanent and records become read-only, so this is the user's last
    // chance to notice missing or short payments. Same wording as the
    // server-side warning (shared builder).
    const warningNote = shortfall ? buildCloseWarning(shortfall) : null
    if (
      !confirm(
        `${warningNote ? `${warningNote}\n\n` : ''}Closing is permanent — records become read-only. Close this season?`,
      )
    ) {
      return
    }
    startTransition(async () => {
      const result = await closeSeason(seasonId)
      if (result.error) {
        alert(result.error._form?.join(', ') ?? 'Failed to close season.')
      } else if ('warning' in result && result.warning) {
        // Backup for a stale pre-check count (payment recorded in another tab).
        alert(result.warning)
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
