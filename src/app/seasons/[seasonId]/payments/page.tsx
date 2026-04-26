import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/queries/_user-context'
import { getSeasonById } from '@/lib/queries/season-queries'
import { getInstallments } from '@/lib/queries/payment-queries'
import { InstallmentSchedule } from '@/components/payment/installment-schedule'
import { formatPKR } from '@/lib/utils/format'

export default async function PaymentsPage({
  params,
}: {
  params: Promise<{ seasonId: string }>
}) {
  const { seasonId } = await params

  const user = await getCurrentUser()
  if (!user) redirect('/login')

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
  const isOverpaid = totalReceived > predeterminedAmount
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

      {isOverpaid && (
        <div className="rounded-lg border border-yellow-300 bg-yellow-50 px-4 py-3 text-sm text-yellow-800 dark:border-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400">
          Total payments ({formatPKR(totalReceived)}) exceed the predetermined amount ({formatPKR(predeterminedAmount)}).
        </div>
      )}

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
          userId={user.id}
        />
      )}
    </div>
  )
}
