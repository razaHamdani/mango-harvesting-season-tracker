import { notFound } from 'next/navigation'
import { getSeasonById } from '@/lib/queries/season-queries'
import { getSeasonFarms } from '@/lib/queries/activity-queries'
import { ExpenseForm } from '@/components/expense/expense-form'

export default async function NewExpensePage({
  params,
}: {
  params: Promise<{ seasonId: string }>
}) {
  const { seasonId } = await params
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
        <h1 className="text-2xl font-bold tracking-tight">Add Expense</h1>
        <p className="text-sm text-muted-foreground">
          Record an expense for the {season.year} season
        </p>
      </div>

      <ExpenseForm seasonId={seasonId} farms={farms} season={season} />
    </div>
  )
}
