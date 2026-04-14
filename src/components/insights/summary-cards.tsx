import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import type { SeasonInsightsView } from '@/lib/queries/insights-queries'
import { formatPKR } from '@/lib/utils/format'

export function SummaryCards({ view }: { view: SeasonInsightsView }) {
  const netIsProfit = view.netProfit >= 0
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Total Revenue
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {formatPKR(view.predeterminedAmount)}
          </div>
          <p className="text-xs text-muted-foreground">
            {formatPKR(view.totalPaymentsReceived)} received
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Total Expenses
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {formatPKR(view.totalExpenses)}
          </div>
          <p className="text-xs text-muted-foreground">Landlord share</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {netIsProfit ? 'Net Profit' : 'Net Loss'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div
            className={`text-2xl font-bold ${
              netIsProfit ? 'text-green-600' : 'text-red-600'
            }`}
          >
            {formatPKR(Math.abs(view.netProfit))}
          </div>
          <p className="text-xs text-muted-foreground">
            Revenue − Expenses
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Boxes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {view.boxesReceived} / {view.agreedBoxes}
          </div>
          <p className="text-xs text-muted-foreground">Received / Agreed</p>
        </CardContent>
      </Card>
    </div>
  )
}
