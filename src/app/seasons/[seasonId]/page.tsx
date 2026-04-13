import { notFound } from 'next/navigation'
import { getSeasonById } from '@/lib/queries/season-queries'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { DutySplitDisplay } from '@/components/season/duty-split-display'
import { SeasonActionButtons } from '@/components/season/season-action-buttons'

function formatPKR(amount: number): string {
  return `Rs. ${amount.toLocaleString('en-PK')}`
}

export default async function SeasonOverviewPage({
  params,
}: {
  params: Promise<{ seasonId: string }>
}) {
  const { seasonId } = await params
  const season = await getSeasonById(seasonId)

  if (!season) {
    notFound()
  }

  const totalPaid = season.installments.reduce(
    (sum, inst) => sum + (inst.paid_amount ?? 0),
    0
  )
  const paymentProgress =
    season.predetermined_amount > 0
      ? Math.min((totalPaid / season.predetermined_amount) * 100, 100)
      : 0

  return (
    <div className="space-y-6">
      {/* Action Buttons */}
      <SeasonActionButtons seasonId={season.id} status={season.status} />

      <div className="grid gap-6 md:grid-cols-2">
        {/* Contract Summary */}
        <Card>
          <CardHeader>
            <CardTitle>Contract Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Contractor</span>
              <span className="font-medium">{season.contractor_name}</span>
            </div>
            {season.contractor_phone && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Phone</span>
                <span className="font-medium">{season.contractor_phone}</span>
              </div>
            )}
            {season.contractor_cnic && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">CNIC</span>
                <span className="font-medium">{season.contractor_cnic}</span>
              </div>
            )}
            <Separator />
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Predetermined Amount</span>
              <span className="font-medium">{formatPKR(season.predetermined_amount)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Agreed Boxes</span>
              <span className="font-medium">{season.agreed_boxes}</span>
            </div>
          </CardContent>
        </Card>

        {/* Duty Split */}
        <Card>
          <CardHeader>
            <CardTitle>Duty Split</CardTitle>
          </CardHeader>
          <CardContent>
            <DutySplitDisplay
              sprayLandlordPct={season.spray_landlord_pct}
              fertilizerLandlordPct={season.fertilizer_landlord_pct}
            />
          </CardContent>
        </Card>

        {/* Payment Progress */}
        <Card>
          <CardHeader>
            <CardTitle>Payment Progress</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-sm">
              {formatPKR(totalPaid)} of {formatPKR(season.predetermined_amount)} received
            </div>
            <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-green-500 transition-all"
                style={{ width: `${paymentProgress}%` }}
              />
            </div>
            <div className="text-xs text-muted-foreground">
              {paymentProgress.toFixed(0)}% complete
            </div>
          </CardContent>
        </Card>

        {/* Box Tracker */}
        <Card>
          <CardHeader>
            <CardTitle>Box Tracker</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-sm">
              {season.boxes_received} of {season.agreed_boxes} boxes received
            </div>
            <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-blue-500 transition-all"
                style={{
                  width: `${season.agreed_boxes > 0 ? Math.min((season.boxes_received / season.agreed_boxes) * 100, 100) : 0}%`,
                }}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Farm Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Farm Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {season.farms.length === 0 ? (
            <p className="text-sm text-muted-foreground">No farms assigned.</p>
          ) : (
            <>
              {season.farms.map((farm) => (
                <div key={farm.id} className="flex justify-between text-sm">
                  <span>{farm.name}</span>
                  <span className="text-muted-foreground">{farm.acreage} acres</span>
                </div>
              ))}
              <Separator />
              <div className="flex justify-between text-sm font-medium">
                <span>Total</span>
                <span>{season.total_acreage.toFixed(2)} acres</span>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
