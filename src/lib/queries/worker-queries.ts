import { createClient } from '@/lib/supabase/server'

export async function getWorkers() {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('workers')
    .select('*')
    .order('name')

  if (error) {
    throw new Error(error.message)
  }

  return data
}
