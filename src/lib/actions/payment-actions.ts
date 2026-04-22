'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { validatePhotoPath } from '@/lib/utils/validate-photo-path'

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

  // Extract and validate form fields
  const amountStr = formData.get('amount') as string
  const amount = parseFloat(amountStr)

  if (!amountStr || isNaN(amount) || amount <= 0) {
    return { error: 'Amount must be greater than 0.' }
  }

  const paidDate = formData.get('paid_date') as string
  if (!paidDate) {
    return { error: 'Payment date is required.' }
  }

  const notes = (formData.get('notes') as string) || null

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
