import { createClient } from '@/lib/supabase/server'
import type { Installment } from '@/types/database'

export async function getInstallments(seasonId: string): Promise<Installment[]> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return []
  }

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
