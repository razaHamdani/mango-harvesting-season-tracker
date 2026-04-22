'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { workerSchema } from '@/lib/utils/validators'
import { mutationLimiter, enforceLimit } from '@/lib/utils/rate-limiter'

export async function createWorker(formData: FormData) {
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

  const { error } = await supabase.from('workers').insert({
    owner_id: user.id,
    name: parsed.data.name,
    phone: parsed.data.phone || null,
    monthly_salary: parsed.data.monthly_salary,
  })

  if (error) {
    console.error('[createWorker] insert failed', error)
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
    console.error('[updateWorker] update failed', error)
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
    console.error('[toggleWorkerActive] update failed', error)
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
    console.error('[deleteWorker] delete failed', error)
    return { error: { _form: ['Failed to delete worker.'] } }
  }

  revalidatePath('/workers')
  return { success: true }
}
