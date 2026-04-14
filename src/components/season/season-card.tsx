import Link from 'next/link'
import type { SeasonWithStats } from '@/lib/queries/season-queries'
import { SeasonStatusBadge } from '@/components/season/season-status-badge'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardAction,
  CardFooter,
} from '@/components/ui/card'
import { formatPKR } from '@/lib/utils/format'

export function SeasonCard({ season }: { season: SeasonWithStats }) {
  return (
    <Link href={`/seasons/${season.id}`} className="block">
      <Card className="transition-shadow hover:shadow-md">
        <CardHeader>
          <CardTitle>{season.year} Season</CardTitle>
          <CardAction>
            <SeasonStatusBadge status={season.status} />
          </CardAction>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Contractor</span>
            <span className="font-medium">{season.contractor_name}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Amount</span>
            <span className="font-medium">
              {formatPKR(season.predetermined_amount)}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Farms</span>
            <span className="font-medium">
              {season.farm_count} ({season.total_acreage.toFixed(2)} acres)
            </span>
          </div>
        </CardContent>
        <CardFooter className="text-xs text-muted-foreground">
          <span>
            Spray {season.spray_landlord_pct}% / Fertilizer{' '}
            {season.fertilizer_landlord_pct}% landlord
          </span>
        </CardFooter>
      </Card>
    </Link>
  )
}
