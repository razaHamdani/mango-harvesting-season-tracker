'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { farmSchema } from '@/lib/utils/validators'
import { ensureProfile } from '@/lib/queries/profile-queries'
import { mutationLimiter, enforceLimit } from '@/lib/utils/rate-limiter'

export async function createFarm(formData: FormData) {
  const parsed = farmSchema.safeParse({
    name: formData.get('name'),
    acreage: formData.get('acreage'),
  })

  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: { _form: ['You must be logged in.'] } }
  }

  const { allowed: createAllowed } = await enforceLimit(mutationLimiter, `user:${user.id}`, true)
  if (!createAllowed) return { error: { _form: ['Too many requests. Try again shortly.'] } }

  await ensureProfile()

  const { error } = await supabase.from('farms').insert({
    owner_id: user.id,
    name: parsed.data.name,
    acreage: parsed.data.acreage,
  })

  if (error) {
    console.error('[createFarm] insert failed', error)
    return { error: { _form: ['Failed to create farm.'] } }
  }

  revalidatePath('/farms')
  return { success: true }
}

export async function updateFarm(id: string, formData: FormData) {
  const parsed = farmSchema.safeParse({
    name: formData.get('name'),
    acreage: formData.get('acreage'),
  })

  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: { _form: ['You must be logged in.'] } }
  }

  const { allowed: updateAllowed } = await enforceLimit(mutationLimiter, `user:${user.id}`, true)
  if (!updateAllowed) return { error: { _form: ['Too many requests. Try again shortly.'] } }

  const { error } = await supabase
    .from('farms')
    .update({
      name: parsed.data.name,
      acreage: parsed.data.acreage,
    })
    .eq('id', id)
    .eq('owner_id', user.id)

  if (error) {
    console.error('[updateFarm] update failed', error)
    return { error: { _form: ['Failed to update farm.'] } }
  }

  revalidatePath('/farms')
  return { success: true }
}

export async function deleteFarm(id: string) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: { _form: ['You must be logged in.'] } }
  }

  const { allowed: deleteAllowed } = await enforceLimit(mutationLimiter, `user:${user.id}`, true)
  if (!deleteAllowed) return { error: { _form: ['Too many requests. Try again shortly.'] } }

  const { error } = await supabase
    .from('farms')
    .delete()
    .eq('id', id)
    .eq('owner_id', user.id)

  if (error) {
    console.error('[deleteFarm] delete failed', error)
    return { error: { _form: ['Failed to delete farm.'] } }
  }

  revalidatePath('/farms')
  return { success: true }
}
