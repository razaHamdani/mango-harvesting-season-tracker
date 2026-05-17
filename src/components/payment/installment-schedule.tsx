'use client'

import { useState } from 'react'
import type { Installment } from '@/types/database'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { PaymentForm } from '@/components/payment/payment-form'
import { formatPKR } from '@/lib/utils/format'

type Status = 'paid' | 'overdue' | 'current' | 'future'

function computeStatuses(installments: Installment[]): Status[] {
  const today = new Date().toISOString().split('T')[0]
  let foundCurrent = false
  return installments.map((inst) => {
    if (inst.paid_amount !== null) return 'paid'
    if (inst.due_date < today) return 'overdue'
    if (!foundCurrent) {
      foundCurrent = true
      return 'current'
    }
    return 'future'
  })
}

function StatusBadge({ status }: { status: Status }) {
  switch (status) {
    case 'paid':
      return <Badge variant="paid">Paid</Badge>
    case 'overdue':
      return <Badge variant="overdue">Overdue</Badge>
    case 'current':
      return <Badge variant="active">Due</Badge>
    case 'future':
      return <Badge variant="pending">Upcoming</Badge>
  }
}

interface InstallmentScheduleProps {
  installments: Installment[]
  seasonId: string
  userId: string
}

export function InstallmentSchedule({
  installments,
  seasonId,
  userId,
}: InstallmentScheduleProps) {
  const [selectedInstallment, setSelectedInstallment] =
    useState<Installment | null>(null)

  const statuses = computeStatuses(installments)
  const totalExpected = installments.reduce((s, i) => s + i.expected_amount, 0)

  return (
    <>
      <div className="timeline">
        {installments.map((inst, i) => {
          const status = statuses[i]
          return (
            <div className={`timeline__row ${status}`} key={inst.id}>
              <div className="timeline__dot">
                <span className="dot-inner" />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span className="h-2">Installment #{inst.installment_number}</span>
                  <StatusBadge status={status} />
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 4 }}>
                  Due {inst.due_date}
                  {status === 'paid' && <> · Paid <span className="tnum">{formatPKR(inst.paid_amount!)}</span> on {inst.paid_date}</>}
                </div>
                {status === 'current' && (
                  <div style={{ marginTop: 12 }}>
                    <Button variant="default" size="sm" onClick={() => setSelectedInstallment(inst)}>
                      Record payment
                    </Button>
                  </div>
                )}
              </div>
              <div style={{ textAlign: 'right' }}>
                <div
                  className="mono"
                  style={{
                    fontSize: status === 'current' ? 20 : 16,
                    fontWeight: 600,
                    color: 'var(--heading)',
                  }}
                >
                  {formatPKR(inst.expected_amount)}
                </div>
                {status === 'paid' && inst.paid_amount !== inst.expected_amount && (
                  <div className="muted t-12 tnum" style={{ marginTop: 2 }}>
                    Actual {formatPKR(inst.paid_amount!)}
                  </div>
                )}
              </div>
            </div>
          )
        })}
        {/* Final completion node */}
        <div className="timeline__row final" style={{ opacity: 0.45 }}>
          <div className="timeline__dot">
            <span className="dot-inner" />
          </div>
          <div>
            <div className="h-2">Season fully paid</div>
            <div className="t-12 muted mt-2">All installments settled.</div>
          </div>
          <div className="mono" style={{ fontSize: 16, color: 'var(--text-muted)' }}>
            {formatPKR(totalExpected)}
          </div>
        </div>
      </div>

      {selectedInstallment && (
        <PaymentForm
          installment={selectedInstallment}
          seasonId={seasonId}
          userId={userId}
          open={!!selectedInstallment}
          onOpenChange={(open) => {
            if (!open) setSelectedInstallment(null)
          }}
        />
      )}
    </>
  )
}
