'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { expenseSchema } from '@/lib/utils/validators'
import { calculateLandlordCost } from '@/lib/utils/duty-split'

export async function createExpense(formData: FormData, seasonId: string) {
  const parsed = expenseSchema.safeParse({
    category: formData.get('category'),
    amount: formData.get('amount'),
    expense_date: formData.get('expense_date'),
    farm_id: formData.get('farm_id'),
    description: formData.get('description'),
    linked_activity_id: formData.get('linked_activity_id') ?? undefined,
  })

  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'You must be logged in.' }
  }

  // Fetch season for duty split config
  const { data: season, error: seasonError } = await supabase
    .from('seasons')
    .select('spray_landlord_pct, fertilizer_landlord_pct')
    .eq('id', seasonId)
    .eq('owner_id', user.id)
    .single()

  if (seasonError || !season) {
    return { error: 'Season not found.' }
  }

  const landlordCost = calculateLandlordCost(
    parsed.data.amount,
    parsed.data.category,
    season
  )

  // Photo (if any) was already uploaded client-side; persist the path only
  // if it is within the caller's namespace.
  const rawPhotoPath = formData.get('photo_path') as string | null
  const photoPath =
    rawPhotoPath && rawPhotoPath.startsWith(`${user.id}/${seasonId}/expenses/`)
      ? rawPhotoPath
      : null

  const { data: expense, error: insertError } = await supabase
    .from('expenses')
    .insert({
      season_id: seasonId,
      farm_id: parsed.data.farm_id || null,
      category: parsed.data.category,
      amount: parsed.data.amount,
      landlord_cost: landlordCost,
      expense_date: parsed.data.expense_date,
      description: parsed.data.description || null,
      linked_activity_id: parsed.data.linked_activity_id || null,
      photo_path: photoPath,
    })
    .select('id')
    .single()

  if (insertError || !expense) {
    return { error: insertError?.message ?? 'Failed to create expense.' }
  }

  revalidatePath(`/seasons/${seasonId}/expenses`)
  return { success: true, expenseId: expense.id }
}

export async function deleteExpense(expenseId: string, seasonId: string) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'You must be logged in.' }
  }

  const { error } = await supabase
    .from('expenses')
    .delete()
    .eq('id', expenseId)

  if (error) {
    return { error: error.message }
  }

  revalidatePath(`/seasons/${seasonId}/expenses`)
  return { success: true }
}
