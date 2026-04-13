import { getFarms } from '@/lib/queries/farm-queries'
import { SeasonCreateForm } from '@/components/season/season-create-form'

export default async function NewSeasonPage() {
  const farms = await getFarms()

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">New Season</h1>
        <p className="text-sm text-muted-foreground">
          Set up a new mango season with contractor details, farms, and payment
          schedule
        </p>
      </div>

      <SeasonCreateForm farms={farms} />
    </div>
  )
}
