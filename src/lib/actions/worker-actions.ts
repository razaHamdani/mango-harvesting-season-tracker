'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { workerSchema } from '@/lib/utils/validators'
import { mutationLimiter, enforceLimit } from '@/lib/utils/rate-limiter'
import { logError } from '@/lib/utils/logger'

export async function createWorker(formData: FormData) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: { _form: ['You must be logged in.'] } }
  }

  const { allowed } = await enforceLimit(mutationLimiter, `user:${user.id}`, true)
  if (!allowed) return { error: { _form: ['Too many requests. Try again shortly.'] } }

  const parsed = workerSchema.safeParse({
    name: formData.get('name'),
    phone: formData.get('phone'),
    monthly_salary: formData.get('monthly_salary'),
  })

  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', user.id)
    .single()

  if (!profile) {
    await logError('createWorker.profileMissing', { userId: user.id, note: 'signup trigger failed' })
    return { error: { _form: ['Account setup is incomplete. Please contact support.'] } }
  }

  const { error } = await supabase.from('workers').insert({
    owner_id: user.id,
    name: parsed.data.name,
    phone: parsed.data.phone || null,
    monthly_salary: parsed.data.monthly_salary,
  })

  if (error) {
    await logError('createWorker.insert', error)
    return { error: { _form: ['Failed to create worker.'] } }
  }

  revalidatePath('/workers')
  return { success: true }
}

export async function updateWorker(id: string, formData: FormData) {
  const parsed = workerSchema.safeParse({
    name: formData.get('name'),
    phone: formData.get('phone'),
    monthly_salary: formData.get('monthly_salary'),
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

  const { allowed } = await enforceLimit(mutationLimiter, `user:${user.id}`, true)
  if (!allowed) return { error: { _form: ['Too many requests. Try again shortly.'] } }

  const { error } = await supabase
    .from('workers')
    .update({
      name: parsed.data.name,
      phone: parsed.data.phone || null,
      monthly_salary: parsed.data.monthly_salary,
    })
    .eq('id', id)
    .eq('owner_id', user.id)

  if (error) {
    await logError('updateWorker.update', error)
    return { error: { _form: ['Failed to update worker.'] } }
  }

  revalidatePath('/workers')
  return { success: true }
}

export async function toggleWorkerActive(id: string) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: { _form: ['You must be logged in.'] } }
  }

  const { allowed } = await enforceLimit(mutationLimiter, `user:${user.id}`, true)
  if (!allowed) return { error: { _form: ['Too many requests. Try again shortly.'] } }

  const { data: worker, error: fetchError } = await supabase
    .from('workers')
    .select('is_active')
    .eq('id', id)
    .eq('owner_id', user.id)
    .single()

  if (fetchError || !worker) {
    return { error: { _form: ['Worker not found.'] } }
  }

  const { error } = await supabase
    .from('workers')
    .update({ is_active: !worker.is_active })
    .eq('id', id)
    .eq('owner_id', user.id)

  if (error) {
    await logError('toggleWorkerActive.update', error)
    return { error: { _form: ['Failed to update worker.'] } }
  }

  revalidatePath('/workers')
  return { success: true }
}

export async function deleteWorker(id: string) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: { _form: ['You must be logged in.'] } }
  }

  const { allowed } = await enforceLimit(mutationLimiter, `user:${user.id}`, true)
  if (!allowed) return { error: { _form: ['Too many requests. Try again shortly.'] } }

  const { error } = await supabase
    .from('workers')
    .delete()
    .eq('id', id)
    .eq('owner_id', user.id)

  if (error) {
    await logError('deleteWorker.delete', error)
    return { error: { _form: ['Failed to delete worker.'] } }
  }

  revalidatePath('/workers')
  return { success: true }
}
