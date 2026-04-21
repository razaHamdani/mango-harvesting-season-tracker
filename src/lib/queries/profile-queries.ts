import { createClient } from '@/lib/supabase/server'
import type { Profile } from '@/types/database'

export type ProfilePublic = Pick<Profile, 'id' | 'role' | 'full_name' | 'phone'>

export async function ensureProfile(): Promise<void> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return

  await supabase.from('profiles').upsert(
    {
      id: user.id,
      full_name: user.user_metadata?.full_name ?? '',
      email: user.email ?? '',
      role: user.user_metadata?.role ?? 'landlord',
    },
    { onConflict: 'id', ignoreDuplicates: true }
  )
}

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
