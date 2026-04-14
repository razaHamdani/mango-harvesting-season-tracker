import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getSeasonById } from '@/lib/queries/season-queries'
import { getSeasonFarms } from '@/lib/queries/activity-queries'
import { ActivityForm } from '@/components/activity/activity-form'

export default async function NewActivityPage({
  params,
}: {
  params: Promise<{ seasonId: string }>
}) {
  const { seasonId } = await params

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [season, farms] = await Promise.all([
    getSeasonById(seasonId),
    getSeasonFarms(seasonId),
  ])

  if (!season) {
    notFound()
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Log Activity</h1>
        <p className="text-sm text-muted-foreground">
          Record a farm activity for the {season.year} season
        </p>
      </div>

      <ActivityForm
        seasonId={seasonId}
        farms={farms}
        season={season}
        userId={user.id}
      />
    </div>
  )
}
