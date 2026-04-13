'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { workerSchema } from '@/lib/utils/validators'

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

  const { error } = await supabase.from('workers').insert({
    owner_id: user.id,
    name: parsed.data.name,
    phone: parsed.data.phone || null,
    monthly_salary: parsed.data.monthly_salary,
  })

  if (error) {
    return { error: { _form: [error.message] } }
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
    return { error: { _form: [error.message] } }
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
    return { error: { _form: [error.message] } }
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

  const { error } = await supabase
    .from('workers')
    .delete()
    .eq('id', id)
    .eq('owner_id', user.id)

  if (error) {
    return { error: { _form: [error.message] } }
  }

  revalidatePath('/workers')
  return { success: true }
}
