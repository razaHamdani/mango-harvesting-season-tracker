'use client'

import { useState } from 'react'
import type { Installment } from '@/types/database'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ImageIcon } from 'lucide-react'
import { PaymentForm } from '@/components/payment/payment-form'

function formatPKR(amount: number): string {
  return `Rs. ${amount.toLocaleString('en-PK')}`
}

function getStatus(installment: Installment): 'paid' | 'overdue' | 'pending' {
  if (installment.paid_amount !== null) return 'paid'
  const today = new Date().toISOString().split('T')[0]
  if (installment.due_date < today) return 'overdue'
  return 'pending'
}

function StatusBadge({ status }: { status: 'paid' | 'overdue' | 'pending' }) {
  switch (status) {
    case 'paid':
      return (
        <Badge className="bg-green-500/10 text-green-700 dark:text-green-400">
          Paid
        </Badge>
      )
    case 'overdue':
      return <Badge variant="destructive">Overdue</Badge>
    case 'pending':
      return <Badge variant="secondary">Pending</Badge>
  }
}

interface InstallmentScheduleProps {
  installments: Installment[]
  seasonId: string
}

export function InstallmentSchedule({
  installments,
  seasonId,
}: InstallmentScheduleProps) {
  const [selectedInstallment, setSelectedInstallment] =
    useState<Installment | null>(null)

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">#</TableHead>
            <TableHead>Expected Amount</TableHead>
            <TableHead>Due Date</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Paid Amount</TableHead>
            <TableHead>Paid Date</TableHead>
            <TableHead className="w-12">Receipt</TableHead>
            <TableHead className="w-24">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {installments.map((inst) => {
            const status = getStatus(inst)
            return (
              <TableRow key={inst.id}>
                <TableCell>{inst.installment_number}</TableCell>
                <TableCell>{formatPKR(inst.expected_amount)}</TableCell>
                <TableCell>{inst.due_date}</TableCell>
                <TableCell>
                  <StatusBadge status={status} />
                </TableCell>
                <TableCell>
                  {inst.paid_amount !== null ? formatPKR(inst.paid_amount) : '-'}
                </TableCell>
                <TableCell>{inst.paid_date ?? '-'}</TableCell>
                <TableCell>
                  {inst.receipt_photo_path ? (
                    <ImageIcon className="size-4 text-muted-foreground" />
                  ) : (
                    '-'
                  )}
                </TableCell>
                <TableCell>
                  {inst.paid_amount === null && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setSelectedInstallment(inst)}
                    >
                      Record Payment
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>

      {selectedInstallment && (
        <PaymentForm
          installment={selectedInstallment}
          seasonId={seasonId}
          open={!!selectedInstallment}
          onOpenChange={(open) => {
            if (!open) setSelectedInstallment(null)
          }}
        />
      )}
    </>
  )
}
