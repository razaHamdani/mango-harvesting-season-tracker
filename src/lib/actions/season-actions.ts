'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { seasonCreateSchema } from '@/lib/utils/validators'
import { mutationLimiter, enforceLimit } from '@/lib/utils/rate-limiter'

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

  const { allowed } = await enforceLimit(mutationLimiter, `user:${user.id}`, true)
  if (!allowed) return { error: { _form: ['Too many requests. Try again shortly.'] } }

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
    // Surface the active-season constraint as a friendly message.
    if (rpcError?.message?.includes('one_active_season_per_owner')) {
      return {
        error: {
          _form: ['An active season already exists. Close it before creating a new one.'],
        },
      }
    }
    console.error('[createSeason] RPC error', rpcError)
    return { error: { _form: ['Failed to create season.'] } }
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

  const { allowed } = await enforceLimit(mutationLimiter, `user:${user.id}`, true)
  if (!allowed) return { error: { _form: ['Too many requests. Try again shortly.'] } }

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

  // Gather child photo paths before the cascade delete drops them.
  // Draft seasons usually don't have these, but the schema doesn't enforce that.
  const [expensePhotos, activityPhotos, installmentPhotos] = await Promise.all([
    supabase.from('expenses').select('photo_path').eq('season_id', id),
    supabase.from('activities').select('photo_path').eq('season_id', id),
    supabase.from('installments').select('receipt_photo_path').eq('season_id', id),
  ])

  const photoPaths = [
    ...(expensePhotos.data ?? []).map((r) => r.photo_path),
    ...(activityPhotos.data ?? []).map((r) => r.photo_path),
    ...(installmentPhotos.data ?? []).map((r) => r.receipt_photo_path),
  ].filter((p): p is string => Boolean(p))

  const { error } = await supabase
    .from('seasons')
    .delete()
    .eq('id', id)
    .eq('owner_id', user.id)

  if (error) {
    console.error('[deleteSeason] delete failed', error)
    return { error: { _form: ['Failed to delete season.'] } }
  }

  // Best-effort storage cleanup. DB cascade already removed the rows.
  if (photoPaths.length > 0) {
    const { error: storageErr } = await supabase.storage
      .from('aam-daata-photos')
      .remove(photoPaths)
    if (storageErr) {
      console.error('[deleteSeason] storage cleanup failed', storageErr)
    }
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

  const { allowed } = await enforceLimit(mutationLimiter, `user:${user.id}`, true)
  if (!allowed) return { error: { _form: ['Too many requests. Try again shortly.'] } }

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

  // The partial unique index 'one_active_season_per_owner' enforces the
  // one-active-at-a-time rule atomically. No pre-check needed.
  const { error } = await supabase
    .from('seasons')
    .update({ status: 'active' })
    .eq('id', id)
    .eq('owner_id', user.id)

  if (error?.code === '23505') {
    return {
      error: {
        _form: ['An active season already exists. Close it before activating another.'],
      },
    }
  }

  if (error) {
    console.error('[activateSeason] update failed', error)
    return { error: { _form: ['Failed to activate season.'] } }
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

  const { allowed } = await enforceLimit(mutationLimiter, `user:${user.id}`, true)
  if (!allowed) return { error: { _form: ['Too many requests. Try again shortly.'] } }

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

  // Phase 5D.7 — warn (but allow) when unpaid installments still exist.
  // The UI can surface the warning so the user confirms before closing.
  const { count: unpaidCount } = await supabase
    .from('installments')
    .select('id', { count: 'exact', head: true })
    .eq('season_id', id)
    .is('paid_amount', null)

  const { error } = await supabase
    .from('seasons')
    .update({ status: 'closed', closed_at: new Date().toISOString() })
    .eq('id', id)
    .eq('owner_id', user.id)

  if (error) {
    console.error('[closeSeason] update failed', error)
    return { error: { _form: ['Failed to close season.'] } }
  }

  revalidatePath(`/seasons/${id}`)
  revalidatePath('/seasons')

  if (unpaidCount && unpaidCount > 0) {
    return {
      success: true as const,
      warning: `${unpaidCount} installment${unpaidCount === 1 ? '' : 's'} still unpaid.`,
    }
  }
  return { success: true as const }
}
