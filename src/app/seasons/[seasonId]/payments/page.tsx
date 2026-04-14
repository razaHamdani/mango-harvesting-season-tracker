import { getSeasonById } from '@/lib/queries/season-queries'
import { getInstallments } from '@/lib/queries/payment-queries'
import { InstallmentSchedule } from '@/components/payment/installment-schedule'

function formatPKR(amount: number): string {
  return `Rs. ${amount.toLocaleString('en-PK')}`
}

export default async function PaymentsPage({
  params,
}: {
  params: Promise<{ seasonId: string }>
}) {
  const { seasonId } = await params

  const [season, installments] = await Promise.all([
    getSeasonById(seasonId),
    getInstallments(seasonId),
  ])

  if (!season) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center">
        <p className="text-sm text-muted-foreground">Season not found.</p>
      </div>
    )
  }

  const totalReceived = installments.reduce(
    (sum, inst) => sum + (inst.paid_amount ?? 0),
    0
  )
  const predeterminedAmount = season.predetermined_amount
  const paymentPercentage =
    predeterminedAmount > 0
      ? Math.round((totalReceived / predeterminedAmount) * 100)
      : 0
  const barWidth = Math.min(paymentPercentage, 100)

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">Payments</h2>

      {/* Progress Bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span>
            {formatPKR(totalReceived)} of {formatPKR(predeterminedAmount)}{' '}
            received ({paymentPercentage}%)
          </span>
        </div>
        <div className="h-3 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
          <div
            className="h-full rounded-full bg-green-500 transition-all"
            style={{ width: `${barWidth}%` }}
          />
        </div>
      </div>

      {/* Installment Schedule */}
      {installments.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <p className="text-sm text-muted-foreground">
            No installments set up for this season.
          </p>
        </div>
      ) : (
        <InstallmentSchedule
          installments={installments}
          seasonId={seasonId}
        />
      )}
    </div>
  )
}
