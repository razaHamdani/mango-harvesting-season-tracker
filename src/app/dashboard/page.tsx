import Link from 'next/link'
import { getDashboardData } from '@/lib/queries/season-queries'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

function formatPKR(amount: number): string {
  return `Rs. ${amount.toLocaleString('en-PK')}`
}

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString('en-PK', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export default async function DashboardPage() {
  const data = await getDashboardData()
  const { activeSeason } = data

  const paymentPct =
    activeSeason && activeSeason.predetermined_amount > 0
      ? Math.min(
          (activeSeason.insights.total_payments_received /
            activeSeason.predetermined_amount) *
            100,
          100
        )
      : 0

  const boxPct =
    activeSeason && activeSeason.agreed_boxes > 0
      ? Math.min(
          (activeSeason.insights.boxes_received / activeSeason.agreed_boxes) *
            100,
          100
        )
      : 0

  return (
    <div className="space-y-6">
      {/* Quick Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Seasons
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.totalSeasons}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Farms
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.totalFarms}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Workers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.totalWorkers}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Active Season
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {activeSeason ? activeSeason.year : '—'}
            </div>
            {activeSeason && (
              <p className="text-xs text-muted-foreground">
                {activeSeason.contractor_name}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {!activeSeason ? (
        <Card>
          <CardHeader>
            <CardTitle>No Active Season</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Start a new season to begin tracking activities, expenses, and
              payments.
            </p>
            <Button render={<Link href="/seasons/new" />}>Create Season</Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Active Season Summary */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>
                  {activeSeason.year} Season
                </CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  Contractor: {activeSeason.contractor_name}
                </p>
              </div>
              <Button
                render={<Link href={`/seasons/${activeSeason.id}`} />}
                variant="outline"
                size="sm"
              >
                Open
              </Button>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Payments</span>
                  <span className="font-medium">
                    {formatPKR(activeSeason.insights.total_payments_received)}{' '}
                    / {formatPKR(activeSeason.predetermined_amount)}
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-green-500 transition-all"
                    style={{ width: `${paymentPct}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  {activeSeason.insights.installments_paid} of{' '}
                  {activeSeason.insights.installments_total} installments paid
                </p>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Boxes</span>
                  <span className="font-medium">
                    {activeSeason.insights.boxes_received} /{' '}
                    {activeSeason.agreed_boxes}
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-blue-500 transition-all"
                    style={{ width: `${boxPct}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Landlord expense total:{' '}
                  {formatPKR(activeSeason.insights.total_expenses)}
                </p>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Upcoming Installments */}
            <Card>
              <CardHeader>
                <CardTitle>Upcoming Installments</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {activeSeason.upcomingInstallments.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    All installments paid.
                  </p>
                ) : (
                  activeSeason.upcomingInstallments.map((inst, idx) => (
                    <div key={inst.id}>
                      {idx > 0 && <Separator className="my-2" />}
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium">
                            Installment #{inst.installment_number}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Due {formatDate(inst.due_date)}
                          </p>
                        </div>
                        <div className="text-sm font-medium">
                          {formatPKR(inst.expected_amount)}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            {/* Recent Activities */}
            <Card>
              <CardHeader>
                <CardTitle>Recent Activities</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {activeSeason.recentActivities.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No activities logged yet.
                  </p>
                ) : (
                  activeSeason.recentActivities.map((act, idx) => (
                    <div key={act.id}>
                      {idx > 0 && <Separator className="my-2" />}
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="capitalize">
                              {act.type}
                            </Badge>
                            <p className="text-sm font-medium">
                              {act.farm_name}
                            </p>
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {formatDate(act.activity_date)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}
