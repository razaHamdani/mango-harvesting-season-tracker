import type { SupabaseClient } from '@supabase/supabase-js'
import { logError } from '@/lib/utils/logger'

export type WorkerGuard = { ok: true } | { ok: false; error: string }

/**
 * Verify that worker_id is owned by the caller (userId).
 * Called in createExpense when category='labor' and a worker_id is supplied.
 */
export async function assertWorkerOwned(
  supabase: SupabaseClient,
  workerId: string,
  userId: string,
): Promise<WorkerGuard> {
  const { data, error } = await supabase
    .from('workers')
    .select('id')
    .eq('id', workerId)
    .eq('owner_id', userId)
    .maybeSingle()

  if (error) {
    await logError('assertWorkerOwned.query', error)
    return { ok: false, error: 'Failed to verify worker. Please try again.' }
  }
  if (!data) return { ok: false, error: 'Selected worker not found.' }
  return { ok: true }
}
