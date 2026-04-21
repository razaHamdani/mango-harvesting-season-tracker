import Link from 'next/link'
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

      {farms.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center space-y-3">
          <p className="font-medium">No farms found</p>
          <p className="text-sm text-muted-foreground">
            You need at least one farm before creating a season.
          </p>
          <Link
            href="/farms"
            className="inline-block text-sm underline underline-offset-4 hover:text-foreground text-muted-foreground"
          >
            Go to Farms to add one
          </Link>
        </div>
      ) : (
        <SeasonCreateForm farms={farms} />
      )}
    </div>
  )
}
