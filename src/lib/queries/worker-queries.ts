import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from './_user-context'

export async function getWorkers() {
  const user = await getCurrentUser()
  if (!user) return []

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('workers')
    .select('*')
    .eq('owner_id', user.id)
    .order('name')

  if (error) {
    throw new Error(error.message)
  }

  return data
}
