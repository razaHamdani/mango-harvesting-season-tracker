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

  // Atomic: single Postgres transaction via RPC. If anything fails
  // (unique-index violation, RLS denial, FK error), nothing is inserted --
  // no orphan seasons, no partial installment schedules.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: newSeasonId, error: rpcError } = await (supabase as any).rpc(
    'create_season_with_children',
    {
      p_owner_id: user.id,
      p_year: parsed.data.year,
      p_contractor_name: parsed.data.contractor_name,
      p_contractor_phone: parsed.data.contractor_phone || null,
      p_contractor_cnic: parsed.data.contractor_cnic || null,
      p_predetermined_amount: parsed.data.predetermined_amount,
      p_spray_landlord_pct: parsed.data.spray_landlord_pct,
      p_fertilizer_landlord_pct: parsed.data.fertilizer_landlord_pct,
      p_agreed_boxes: parsed.data.agreed_boxes,
      p_farm_ids: parsed.data.farm_ids,
      p_installments: parsed.data.installments,
    }
  )

  if (rpcError || !newSeasonId) {
    const msg = rpcError?.message ?? 'Failed to create season.'
    // Surface the active-season constraint as a friendly message.
    if (msg.includes('one_active_season_per_owner')) {
      return {
        error: {
          _form: ['An active season already exists. Close it before creating a new one.'],
        },
      }
    }
    return { error: { _form: [msg] } }
  }

  revalidatePath('/seasons')
  return { id: newSeasonId as string }
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
