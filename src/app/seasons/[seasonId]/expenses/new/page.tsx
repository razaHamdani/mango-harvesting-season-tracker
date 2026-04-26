import { notFound, redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/queries/_user-context'
import { getSeasonById } from '@/lib/queries/season-queries'
import { getSeasonFarms, getActivities } from '@/lib/queries/activity-queries'
import { ExpenseForm } from '@/components/expense/expense-form'

export default async function NewExpensePage({
  params,
}: {
  params: Promise<{ seasonId: string }>
}) {
  const { seasonId } = await params

  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const [season, farms, { items: activities }] = await Promise.all([
    getSeasonById(seasonId),
    getSeasonFarms(seasonId),
    getActivities(seasonId),
  ])

  if (!season) {
    notFound()
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Add Expense</h1>
        <p className="text-sm text-muted-foreground">
          Record an expense for the {season.year} season
        </p>
      </div>

      <ExpenseForm
        seasonId={seasonId}
        farms={farms}
        season={season}
        userId={user.id}
        activities={activities}
      />
    </div>
  )
}
