import { createClient } from '@/lib/supabase/server'
import type { Profile } from '@/types/database'

export type ProfilePublic = Pick<Profile, 'id' | 'role' | 'full_name' | 'phone'>

export async function getCurrentProfile(): Promise<ProfilePublic | null> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const { data } = await supabase
    .from('profiles')
    .select('id, role, full_name, phone')
    .eq('id', user.id)
    .single()

  return data ?? null
}
