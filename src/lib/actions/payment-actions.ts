'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { uploadPhotoToStorage } from '@/lib/utils/photo'

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

  // Fetch the installment and validate it is not already paid
  const { data: installment, error: fetchError } = await supabase
    .from('installments')
    .select('*')
    .eq('id', installmentId)
    .eq('season_id', seasonId)
    .single()

  if (fetchError || !installment) {
    return { error: 'Installment not found.' }
  }

  if (installment.paid_amount !== null) {
    return { error: 'This installment has already been recorded.' }
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

  // Update the installment
  const { error: updateError } = await supabase
    .from('installments')
    .update({
      paid_amount: amount,
      paid_date: paidDate,
      notes,
    })
    .eq('id', installmentId)

  if (updateError) {
    return { error: updateError.message }
  }

  // Handle receipt photo upload
  const photo = formData.get('photo') as File | null
  if (photo && photo.size > 0) {
    const path = `${user.id}/${seasonId}/payments/${installmentId}.jpg`
    const storedPath = await uploadPhotoToStorage(supabase, photo, path)

    if (storedPath) {
      await supabase
        .from('installments')
        .update({ receipt_photo_path: storedPath })
        .eq('id', installmentId)
    }
  }

  // Check if cumulative payments exceed predetermined_amount (warn only)
  const { data: season } = await supabase
    .from('seasons')
    .select('predetermined_amount')
    .eq('id', seasonId)
    .single()

  const { data: allInstallments } = await supabase
    .from('installments')
    .select('paid_amount')
    .eq('season_id', seasonId)

  let warning: string | undefined
  if (season && allInstallments) {
    const totalPaid = allInstallments.reduce(
      (sum, inst) => sum + (inst.paid_amount ?? 0),
      0
    )
    if (totalPaid > season.predetermined_amount) {
      warning = `Total payments (Rs. ${totalPaid.toLocaleString('en-PK')}) exceed the predetermined amount (Rs. ${season.predetermined_amount.toLocaleString('en-PK')}).`
    }
  }

  revalidatePath(`/seasons/${seasonId}/payments`)
  return { success: true, warning }
}
