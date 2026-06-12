import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/queries/_user-context'
import { getSeasonById } from '@/lib/queries/season-queries'
import { getInstallments } from '@/lib/queries/payment-queries'
import { InstallmentSchedule } from '@/components/payment/installment-schedule'
import { formatPKR } from '@/lib/utils/format'
import { summarizeInstallments } from '@/lib/utils/installment-shortfall'

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
  const paymentPercentage =
    predeterminedAmount > 0
      ? Math.round((totalReceived / predeterminedAmount) * 100)
      : 0
  const barWidth = Math.min(paymentPercentage, 100)

  const nextDue = installments.find((i) => i.paid_amount === null) ?? null
  const shortfall = summarizeInstallments(installments)

  return (
    <div className="flex flex-col gap-6 mt-6">
      {/* 3-col KPI row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 16 }}>
        <div className="card card__pad">
          <div className="section-label">Received</div>
          <div className="mono" style={{ fontSize: 24, fontWeight: 600, marginTop: 6, color: 'var(--heading)' }}>
            {formatPKR(totalReceived)}
          </div>
          <div style={{ height: 4, background: 'var(--border)', borderRadius: 999, marginTop: 10, overflow: 'hidden' }}>
            <div style={{ height: '100%', background: 'var(--leaf)', borderRadius: 999, width: `${barWidth}%`, transition: 'width 0.3s' }} />
          </div>
          <div className="muted t-12 mt-2">{paymentPercentage}% of {formatPKR(predeterminedAmount)}</div>
        </div>
        <div className="card card__pad">
          <div className="section-label">Remaining</div>
          <div className="mono" style={{ fontSize: 24, fontWeight: 600, marginTop: 6, color: 'var(--heading)' }}>
            {formatPKR(Math.max(0, predeterminedAmount - totalReceived))}
          </div>
          <div className="muted t-12 mt-3">
            {shortfall.unpaidCount} installments to go
            {shortfall.underpaidCount > 0 && (
              <span style={{ color: 'var(--rust)' }}>
                {' '}· {shortfall.underpaidCount} underpaid (short{' '}
                {formatPKR(shortfall.shortfallTotal)})
              </span>
            )}
          </div>
        </div>
        {nextDue ? (
          <div className="card card__pad">
            <div className="section-label">Next due</div>
            <div className="mono" style={{ fontSize: 24, fontWeight: 600, marginTop: 6, color: 'var(--heading)' }}>
              {formatPKR(nextDue.expected_amount)}
            </div>
            <div className="muted t-12 mt-3">{nextDue.due_date}</div>
          </div>
        ) : (
          <div className="card card__pad">
            <div className="section-label">Next due</div>
            <div className="muted t-14 mt-3">All paid</div>
          </div>
        )}
      </div>

      {/* Schedule card */}
      {installments.length === 0 ? (
        <div className="card card__pad text-center">
          <p className="muted text-sm">No installments set up for this season.</p>
        </div>
      ) : (
        <div className="card card__pad">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div>
              <div className="card__title">Installment schedule</div>
              <div className="card__sub">{installments.length} installments over the season</div>
            </div>
          </div>
          <InstallmentSchedule installments={installments} seasonId={seasonId} userId={user.id} />
        </div>
      )}
    </div>
  )
}
