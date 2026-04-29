import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from './_user-context'
import type { Installment } from '@/types/database'

export async function getInstallments(seasonId: string): Promise<Installment[]> {
  const user = await getCurrentUser()
  if (!user) return []

  const supabase = await createClient()

  // Ownership pre-check (defense-in-depth on top of RLS) — same pattern as
  // getExpenses / getActivities for consistency across the query layer.
  const { data: ownedSeason } = await supabase
    .from('seasons')
    .select('id')
    .eq('id', seasonId)
    .eq('owner_id', user.id)
    .maybeSingle()
  if (!ownedSeason) return []

  const { data: installments, error } = await supabase
    .from('installments')
    .select('*')
    .eq('season_id', seasonId)
    .order('installment_number', { ascending: true })

  if (error) {
    throw new Error(error.message)
  }

  return installments ?? []
}
