'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { expenseSchema } from '@/lib/utils/validators'
import { calculateLandlordCost } from '@/lib/utils/duty-split'
import { validatePhotoPath } from '@/lib/utils/validate-photo-path'
import { mutationLimiter, enforceLimit } from '@/lib/utils/rate-limiter'

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

  const { allowed } = await enforceLimit(mutationLimiter, `user:${user.id}`, true)
  if (!allowed) return { error: 'Too many requests. Try again shortly.' }

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
  // if it passes strict format + ownership validation.
  const rawPhotoPath = formData.get('photo_path') as string | null
  const photoPath = validatePhotoPath(rawPhotoPath, user.id, seasonId, 'expenses')

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
    console.error('[createExpense] insert failed', insertError)
    return { error: 'Failed to create expense.' }
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

  const { allowed } = await enforceLimit(mutationLimiter, `user:${user.id}`, true)
  if (!allowed) return { error: 'Too many requests. Try again shortly.' }

  // Ownership pre-check (two steps, both required):
  //
  // Step 1 — verify the caller owns the season the expense claims to belong to.
  // Prevents: user B supplies their own valid seasonId paired with user A's expenseId.
  const { data: ownedSeason } = await supabase
    .from('seasons')
    .select('id')
    .eq('id', seasonId)
    .eq('owner_id', user.id)
    .maybeSingle()

  if (!ownedSeason) {
    return { error: 'Expense not found.' }
  }

  // Step 2 — verify the expense actually belongs to that season.
  // Prevents: user B supplies user A's seasonId + user A's expenseId
  // (step 1 would fail that too, but belt-and-suspenders).
  const { data: ownedExpense } = await supabase
    .from('expenses')
    .select('id')
    .eq('id', expenseId)
    .eq('season_id', seasonId)
    .maybeSingle()

  if (!ownedExpense) {
    return { error: 'Expense not found.' }
  }

  // Delete with both constraints to close any TOCTOU window.
  const { error } = await supabase
    .from('expenses')
    .delete()
    .eq('id', expenseId)
    .eq('season_id', seasonId)

  if (error) {
    console.error('[deleteExpense] delete failed', error)
    return { error: 'Failed to delete expense.' }
  }

  revalidatePath(`/seasons/${seasonId}/expenses`)
  return { success: true }
}
