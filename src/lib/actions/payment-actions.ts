'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { validatePhotoPath } from '@/lib/utils/validate-photo-path'
import { mutationLimiter, enforceLimit } from '@/lib/utils/rate-limiter'
import { assertWithinSeasonWindow } from '@/lib/utils/season-date-guard'
import { paymentSchema } from '@/lib/utils/validators'

export async function recordPayment(
  installmentId: string,
  formData: FormData,
  seasonId: string
) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'You must be logged in.' }
  }

  const { allowed } = await enforceLimit(mutationLimiter, `user:${user.id}`, true)
  if (!allowed) return { error: 'Too many requests. Try again shortly.' }

  // Ownership pre-check: verify caller owns seasonId before touching any data.
  const { data: ownedSeason } = await supabase
    .from('seasons')
    .select('id')
    .eq('id', seasonId)
    .eq('owner_id', user.id)
    .maybeSingle()
  if (!ownedSeason) return { error: 'Season not found.' }

  // Extract and validate form fields
  const parsed = paymentSchema.safeParse({
    amount: formData.get('amount'),
    paid_date: formData.get('paid_date'),
    notes: formData.get('notes') ?? undefined,
  })
  if (!parsed.success) {
    const messages = Object.values(parsed.error.flatten().fieldErrors).flat()
    return { error: messages[0] ?? 'Invalid input.' }
  }
  const { amount, paid_date: paidDate, notes: rawNotes } = parsed.data
  const notes = rawNotes || null

  const guard = await assertWithinSeasonWindow(supabase, seasonId, paidDate)
  if (!guard.ok) {
    return { error: guard.error }
  }

  // Photo (if any) was already uploaded client-side; persist the path only
  // if it passes strict format + ownership validation.
  const rawPhotoPath = formData.get('photo_path') as string | null
  const receiptPhotoPath = validatePhotoPath(rawPhotoPath, user.id, seasonId, 'payments')

  // Atomic update: only succeeds if paid_amount IS NULL (prevents TOCTOU
  // double-write from double-click / concurrent tabs). RLS still scopes by
  // season ownership via the season_id FK policy.
  const { data: updated, error: updateError } = await supabase
    .from('installments')
    .update({
      paid_amount: amount,
      paid_date: paidDate,
      notes,
      receipt_photo_path: receiptPhotoPath,
    })
    .eq('id', installmentId)
    .eq('season_id', seasonId)
    .is('paid_amount', null)
    .select('id')

  if (updateError) {
    console.error('[recordPayment] update failed', updateError)
    return { error: 'Failed to record payment.' }
  }

  if (!updated || updated.length === 0) {
    // Either the installment doesn't exist / not owned, or it was already paid.
    // Disambiguate with a follow-up read so the UI can show the right message.
    const { data: existing } = await supabase
      .from('installments')
      .select('paid_amount')
      .eq('id', installmentId)
      .eq('season_id', seasonId)
      .maybeSingle()

    if (!existing) {
      return { error: 'Installment not found.' }
    }
    return { error: 'This installment has already been recorded.' }
  }

  revalidatePath(`/seasons/${seasonId}/payments`)
  return { success: true }
}
