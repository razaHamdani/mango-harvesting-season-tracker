'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { seasonCreateSchema } from '@/lib/utils/validators'
import { mutationLimiter, enforceLimit } from '@/lib/utils/rate-limiter'
import { logError } from '@/lib/utils/logger'
import { todayInAppTz } from '@/lib/utils/app-date'
import { summarizeInstallments, buildCloseWarning } from '@/lib/utils/installment-shortfall'

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
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: { _form: ['You must be logged in.'] } }
  }

  const { allowed } = await enforceLimit(mutationLimiter, `user:${user.id}`, true)
  if (!allowed) return { error: { _form: ['Too many requests. Try again shortly.'] } }

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
    await logError('createSeason.rpc', rpcError)
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

  // Compare-and-set: the status filter closes the TOCTOU window between the
  // pre-check above and this DELETE. Without it, a concurrent activate could
  // land in between and this would cascade-delete an ACTIVE season with all
  // its children. Same pattern as recordPayment's .is('paid_amount', null).
  const { data: deleted, error } = await supabase
    .from('seasons')
    .delete()
    .eq('id', id)
    .eq('owner_id', user.id)
    .eq('status', 'draft')
    .select('id')

  if (error) {
    await logError('deleteSeason.delete', error)
    return { error: { _form: ['Failed to delete season.'] } }
  }

  if (!deleted || deleted.length === 0) {
    // Status changed between pre-check and delete (e.g. activated in another tab).
    return { error: { _form: ['Only draft seasons can be deleted.'] } }
  }

  // Best-effort storage cleanup. DB cascade already removed the rows.
  if (photoPaths.length > 0) {
    const { error: storageErr } = await supabase.storage
      .from('aam-daata-photos')
      .remove(photoPaths)
    if (storageErr) {
      await logError('deleteSeason.storageCleanup', storageErr)
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
  // started_at = today's date in the business timezone — used to reject
  // pre-dated child records. Activating at 1am PKT must stamp the PKT date,
  // not the UTC one (which would still be yesterday).
  // Compare-and-set: the status filter closes the TOCTOU window between the
  // pre-check above and this UPDATE (e.g. a concurrent delete removed the row,
  // or a concurrent activate already flipped it — without the filter both
  // would report success).
  const startedAt = todayInAppTz()
  const { data: activated, error } = await supabase
    .from('seasons')
    .update({ status: 'active', started_at: startedAt })
    .eq('id', id)
    .eq('owner_id', user.id)
    .eq('status', 'draft')
    .select('id')

  if (error?.code === '23505') {
    return {
      error: {
        _form: ['An active season already exists. Close it before activating another.'],
      },
    }
  }

  if (error) {
    await logError('activateSeason.update', error)
    return { error: { _form: ['Failed to activate season.'] } }
  }

  if (!activated || activated.length === 0) {
    // Row gone or status changed between pre-check and update.
    return { error: { _form: ['Only draft seasons can be activated.'] } }
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

  // Phase 5D.7 / S3 — warn (but allow) when installments are unpaid OR were
  // recorded short. Fetches the amount columns instead of a head-count:
  // underpaid means paid_amount < expected_amount, and PostgREST can't
  // compare two columns in a filter.
  const { data: installmentRows } = await supabase
    .from('installments')
    .select('expected_amount, paid_amount')
    .eq('season_id', id)

  // Compare-and-set: only an active season can transition to closed. Closes
  // the window where a concurrent close (double-click, second tab) would
  // silently overwrite closed_at with a later timestamp.
  const { data: closed, error } = await supabase
    .from('seasons')
    .update({ status: 'closed', closed_at: new Date().toISOString() })
    .eq('id', id)
    .eq('owner_id', user.id)
    .eq('status', 'active')
    .select('id')

  if (error) {
    await logError('closeSeason.update', error)
    return { error: { _form: ['Failed to close season.'] } }
  }

  if (!closed || closed.length === 0) {
    // Status changed between pre-check and update.
    return { error: { _form: ['Only active seasons can be closed.'] } }
  }

  revalidatePath(`/seasons/${id}`)
  revalidatePath('/seasons')

  const warning = buildCloseWarning(summarizeInstallments(installmentRows ?? []))
  if (warning) {
    return { success: true as const, warning }
  }
  return { success: true as const }
}
