'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import type { Installment } from '@/types/database'
import { recordPayment } from '@/lib/actions/payment-actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { PhotoUpload } from '@/components/photo/photo-upload'

function formatPKR(amount: number): string {
  return `Rs. ${amount.toLocaleString('en-PK')}`
}

interface PaymentFormProps {
  installment: Installment
  seasonId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function PaymentForm({
  installment,
  seasonId,
  open,
  onOpenChange,
}: PaymentFormProps) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const [amount, setAmount] = useState(String(installment.expected_amount))
  const [paidDate, setPaidDate] = useState(
    new Date().toISOString().split('T')[0]
  )
  const [notes, setNotes] = useState('')
  const [photo, setPhoto] = useState<File | null>(null)

  function handleSubmit() {
    setError(null)

    startTransition(async () => {
      const formData = new FormData()
      formData.set('amount', amount)
      formData.set('paid_date', paidDate)
      formData.set('notes', notes)

      if (photo) {
        formData.set('photo', photo)
      }

      const result = await recordPayment(installment.id, formData, seasonId)

      if (result.error) {
        setError(result.error)
        return
      }

      if (result.warning) {
        toast.warning(result.warning)
      }

      toast.success('Payment recorded')
      onOpenChange(false)
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Record Payment</DialogTitle>
          <DialogDescription>
            #{installment.installment_number} &mdash;{' '}
            {formatPKR(installment.expected_amount)} due on{' '}
            {installment.due_date}
          </DialogDescription>
        </DialogHeader>

        <form action={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="amount">Amount Received</Label>
            <Input
              id="amount"
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="paid_date">Date</Label>
            <Input
              id="paid_date"
              type="date"
              value={paidDate}
              onChange={(e) => setPaidDate(e.target.value)}
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="notes">Notes (optional)</Label>
            <textarea
              id="notes"
              className="flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              placeholder="Any notes about this payment"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Receipt Photo (optional)</Label>
            <PhotoUpload name="receipt_photo" onChange={setPhoto} />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Saving...' : 'Record Payment'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
