'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { seasonCreateSchema } from '@/lib/utils/validators'

type SeasonInput = {
  year: number
  contractor_name: string
  contractor_phone?: string
  contractor_cnic?: string
  predetermined_amount: number
  spray_landlord_pct: number
  fertilizer_landlord_pct: number
  agreed_boxes: number
  farm_ids: string[]
  installments: { amount: number; due_date: string }[]
}

export async function createSeason(data: SeasonInput) {
  const parsed = seasonCreateSchema.safeParse(data)

  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  // Validate installment amounts sum to predetermined_amount
  const installmentSum = parsed.data.installments.reduce(
    (sum, inst) => sum + inst.amount,
    0
  )
  if (Math.abs(installmentSum - parsed.data.predetermined_amount) >= 0.01) {
    return {
      error: {
        _form: [
          `Installment amounts (${installmentSum.toLocaleString()}) must equal the predetermined amount (${parsed.data.predetermined_amount.toLocaleString()})`,
        ],
      },
    }
  }

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: { _form: ['You must be logged in.'] } }
  }

  // Check no other active season exists
  const { data: activeSeason } = await supabase
    .from('seasons')
    .select('id')
    .eq('owner_id', user.id)
    .eq('status', 'active')
    .limit(1)
    .single()

  if (activeSeason) {
    return {
      error: {
        _form: ['An active season already exists. Close it before creating a new one.'],
      },
    }
  }

  // Insert season
  const { data: season, error: seasonError } = await supabase
    .from('seasons')
    .insert({
      owner_id: user.id,
      year: parsed.data.year,
      status: 'draft',
      contractor_name: parsed.data.contractor_name,
      contractor_phone: parsed.data.contractor_phone || null,
      contractor_cnic: parsed.data.contractor_cnic || null,
      predetermined_amount: parsed.data.predetermined_amount,
      spray_landlord_pct: parsed.data.spray_landlord_pct,
      fertilizer_landlord_pct: parsed.data.fertilizer_landlord_pct,
      agreed_boxes: parsed.data.agreed_boxes,
    })
    .select('id')
    .single()

  if (seasonError || !season) {
    return { error: { _form: [seasonError?.message ?? 'Failed to create season.'] } }
  }

  // Insert season_farms
  const seasonFarms = parsed.data.farm_ids.map((farm_id) => ({
    season_id: season.id,
    farm_id,
  }))

  const { error: farmsError } = await supabase
    .from('season_farms')
    .insert(seasonFarms)

  if (farmsError) {
    // Clean up the season if farm insertion fails
    await supabase.from('seasons').delete().eq('id', season.id)
    return { error: { _form: [farmsError.message] } }
  }

  // Insert installments
  const installments = parsed.data.installments.map((inst, index) => ({
    season_id: season.id,
    installment_number: index + 1,
    expected_amount: inst.amount,
    due_date: inst.due_date,
  }))

  const { error: installmentsError } = await supabase
    .from('installments')
    .insert(installments)

  if (installmentsError) {
    // Clean up - CASCADE on season delete handles season_farms
    await supabase.from('seasons').delete().eq('id', season.id)
    return { error: { _form: [installmentsError.message] } }
  }

  revalidatePath('/seasons')
  return { id: season.id }
}

export async function deleteSeason(id: string) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: { _form: ['You must be logged in.'] } }
  }

  // Verify season is in draft status
  const { data: season } = await supabase
    .from('seasons')
    .select('status')
    .eq('id', id)
    .eq('owner_id', user.id)
    .single()

  if (!season) {
    return { error: { _form: ['Season not found.'] } }
  }

  if (season.status !== 'draft') {
    return { error: { _form: ['Only draft seasons can be deleted.'] } }
  }

  const { error } = await supabase
    .from('seasons')
    .delete()
    .eq('id', id)
    .eq('owner_id', user.id)

  if (error) {
    return { error: { _form: [error.message] } }
  }

  revalidatePath('/seasons')
  return { success: true }
}

// TODO: updateSeason(id, data) -- placeholder for future edit form

export async function activateSeason(id: string) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: { _form: ['You must be logged in.'] } }
  }

  // Verify season exists and is in draft status
  const { data: season } = await supabase
    .from('seasons')
    .select('status')
    .eq('id', id)
    .eq('owner_id', user.id)
    .single()

  if (!season) {
    return { error: { _form: ['Season not found.'] } }
  }

  if (season.status !== 'draft') {
    return { error: { _form: ['Only draft seasons can be activated.'] } }
  }

  // Check no other active season exists
  const { data: activeSeason } = await supabase
    .from('seasons')
    .select('id')
    .eq('owner_id', user.id)
    .eq('status', 'active')
    .limit(1)
    .single()

  if (activeSeason) {
    return {
      error: {
        _form: ['An active season already exists. Close it before activating another.'],
      },
    }
  }

  const { error } = await supabase
    .from('seasons')
    .update({ status: 'active' })
    .eq('id', id)
    .eq('owner_id', user.id)

  if (error) {
    return { error: { _form: [error.message] } }
  }

  revalidatePath(`/seasons/${id}`)
  revalidatePath('/seasons')
  return { success: true }
}

export async function closeSeason(id: string) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: { _form: ['You must be logged in.'] } }
  }

  // Verify season exists and is active
  const { data: season } = await supabase
    .from('seasons')
    .select('status')
    .eq('id', id)
    .eq('owner_id', user.id)
    .single()

  if (!season) {
    return { error: { _form: ['Season not found.'] } }
  }

  if (season.status !== 'active') {
    return { error: { _form: ['Only active seasons can be closed.'] } }
  }

  const { error } = await supabase
    .from('seasons')
    .update({ status: 'closed', closed_at: new Date().toISOString() })
    .eq('id', id)
    .eq('owner_id', user.id)

  if (error) {
    return { error: { _form: [error.message] } }
  }

  revalidatePath(`/seasons/${id}`)
  revalidatePath('/seasons')
  return { success: true }
}
