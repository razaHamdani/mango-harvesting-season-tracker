'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { activitySchema } from '@/lib/utils/validators'
import { validatePhotoPath } from '@/lib/utils/validate-photo-path'
import { mutationLimiter, enforceLimit } from '@/lib/utils/rate-limiter'

export async function createActivity(formData: FormData, seasonId: string) {
  const parsed = activitySchema.safeParse({
    type: formData.get('type'),
    farm_id: formData.get('farm_id'),
    activity_date: formData.get('activity_date'),
    item_name: formData.get('item_name'),
    meter_reading: formData.get('meter_reading') || undefined,
    boxes_collected: formData.get('boxes_collected') || undefined,
    description: formData.get('description'),
  })

  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  if (!seasonId) {
    return { error: 'Season ID is required.' }
  }

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'You must be logged in.' }
  }

  const { allowed: createAllowed } = await enforceLimit(mutationLimiter, `user:${user.id}`, true)
  if (!createAllowed) return { error: 'Too many requests. Try again shortly.' }

  // Ownership pre-check: verify the caller owns this season.
  const { data: ownedSeason } = await supabase
    .from('seasons')
    .select('id')
    .eq('id', seasonId)
    .eq('owner_id', user.id)
    .maybeSingle()

  if (!ownedSeason) {
    return { error: 'Season not found.' }
  }

  // Photo (if any) was already uploaded client-side; persist the path only
  // if it passes strict format + ownership validation.
  const rawPhotoPath = formData.get('photo_path') as string | null
  const photoPath = validatePhotoPath(rawPhotoPath, user.id, seasonId, 'activities')

  const { data: activity, error: insertError } = await supabase
    .from('activities')
    .insert({
      season_id: seasonId,
      farm_id: parsed.data.farm_id,
      type: parsed.data.type,
      activity_date: parsed.data.activity_date,
      item_name: parsed.data.item_name || null,
      meter_reading: parsed.data.meter_reading ?? null,
      boxes_collected: parsed.data.boxes_collected ?? null,
      description: parsed.data.description || null,
      photo_path: photoPath,
    })
    .select('id')
    .single()

  if (insertError || !activity) {
    console.error('[createActivity] insert failed', insertError)
    return { error: 'Failed to create activity.' }
  }

  revalidatePath(`/seasons/${seasonId}/activities`)
  return { success: true, activityId: activity.id }
}

export async function deleteActivity(activityId: string, seasonId: string) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'You must be logged in.' }
  }

  const { allowed: deleteAllowed } = await enforceLimit(mutationLimiter, `user:${user.id}`, true)
  if (!deleteAllowed) return { error: 'Too many requests. Try again shortly.' }

  // Ownership pre-check (two steps, both required):
  //
  // Step 1 — verify the caller owns the season the activity claims to belong to.
  const { data: ownedSeason } = await supabase
    .from('seasons')
    .select('id')
    .eq('id', seasonId)
    .eq('owner_id', user.id)
    .maybeSingle()

  if (!ownedSeason) {
    return { error: 'Activity not found.' }
  }

  // Step 2 — verify the activity actually belongs to that season AND grab
  // the photo_path so we can clean up the storage object after delete.
  const { data: ownedActivity } = await supabase
    .from('activities')
    .select('id, photo_path')
    .eq('id', activityId)
    .eq('season_id', seasonId)
    .maybeSingle()

  if (!ownedActivity) {
    return { error: 'Activity not found.' }
  }

  // Delete with both constraints to close any TOCTOU window.
  const { error } = await supabase
    .from('activities')
    .delete()
    .eq('id', activityId)
    .eq('season_id', seasonId)

  if (error) {
    console.error('[deleteActivity] delete failed', error)
    return { error: 'Failed to delete activity.' }
  }

  // Best-effort storage cleanup. The DB row is already gone — a storage
  // failure here only leaks an orphan object, not data integrity.
  if (ownedActivity.photo_path) {
    const { error: storageErr } = await supabase.storage
      .from('aam-daata-photos')
      .remove([ownedActivity.photo_path])
    if (storageErr) {
      console.error('[deleteActivity] storage cleanup failed', storageErr)
    }
  }

  revalidatePath(`/seasons/${seasonId}/activities`)
  return { success: true }
}
