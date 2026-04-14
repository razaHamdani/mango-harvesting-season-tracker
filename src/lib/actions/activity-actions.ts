'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { activitySchema } from '@/lib/utils/validators'

export async function createActivity(formData: FormData) {
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

  const seasonId = formData.get('season_id') as string
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

  // Photo (if any) was already uploaded client-side; we just persist the path.
  // Validate the path is within the user's namespace to prevent spoofing.
  const rawPhotoPath = formData.get('photo_path') as string | null
  const photoPath =
    rawPhotoPath && rawPhotoPath.startsWith(`${user.id}/${seasonId}/activities/`)
      ? rawPhotoPath
      : null

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
    return { error: insertError?.message ?? 'Failed to create activity.' }
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

  const { error } = await supabase
    .from('activities')
    .delete()
    .eq('id', activityId)

  if (error) {
    return { error: error.message }
  }

  revalidatePath(`/seasons/${seasonId}/activities`)
  return { success: true }
}
