import { createClient } from '@/lib/supabase/server'

export async function getFarms() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return []
  }

  const { data, error } = await supabase
    .from('farms')
    .select('*')
    .eq('owner_id', user.id)
    .order('name')

  if (error) {
    throw new Error(error.message)
  }

  return data
}
