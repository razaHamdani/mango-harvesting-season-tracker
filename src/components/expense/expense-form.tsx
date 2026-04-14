'use client'

import { useState, useTransition, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import type { Farm, Season, ExpenseCategory } from '@/types/database'
import { createExpense } from '@/lib/actions/expense-actions'
import { calculateLandlordCost } from '@/lib/utils/duty-split'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { PhotoUpload } from '@/components/photo/photo-upload'

interface ExpenseFormProps {
  seasonId: string
  farms: Farm[]
  season: Pick<Season, 'id' | 'year' | 'spray_landlord_pct' | 'fertilizer_landlord_pct'>
  userId: string
}

const EXPENSE_CATEGORIES: { value: ExpenseCategory; label: string }[] = [
  { value: 'electricity', label: 'Electricity' },
  { value: 'spray', label: 'Spray' },
  { value: 'fertilizer', label: 'Fertilizer' },
  { value: 'labor', label: 'Labor' },
  { value: 'misc', label: 'Misc' },
]

type FieldErrors = Record<string, string[] | undefined>

export function ExpenseForm({ seasonId, farms, season, userId }: ExpenseFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [errors, setErrors] = useState<FieldErrors>({})

  const [category, setCategory] = useState<ExpenseCategory>('electricity')
  const [amount, setAmount] = useState('')
  const [expenseDate, setExpenseDate] = useState(
    new Date().toISOString().split('T')[0]
  )
  const [farmId, setFarmId] = useState('')
  const [description, setDescription] = useState('')
  const [photoPath, setPhotoPath] = useState<string | null>(null)

  const parsedAmount = parseFloat(amount) || 0

  const dutySplitPreview = useMemo(() => {
    if (parsedAmount <= 0) return null

    const landlordCost = calculateLandlordCost(parsedAmount, category, season)
    const contractorCost = Math.round((parsedAmount - landlordCost) * 100) / 100

    if (category === 'spray' || category === 'fertilizer') {
      const pct =
        category === 'spray'
          ? season.spray_landlord_pct
          : season.fertilizer_landlord_pct
      const contractorPct = 100 - pct
      return {
        type: 'split' as const,
        landlordCost,
        landlordPct: pct,
        contractorCost,
        contractorPct,
      }
    }

    return { type: 'full' as const, landlordCost }
  }, [parsedAmount, category, season])

  function handleSubmit() {
    startTransition(async () => {
      const formData = new FormData()
      formData.set('category', category)
      formData.set('amount', amount)
      formData.set('expense_date', expenseDate)
      formData.set('farm_id', farmId)
      formData.set('description', description)

      if (photoPath) {
        formData.set('photo_path', photoPath)
      }

      const result = await createExpense(formData, seasonId)

      if (result.error) {
        if (typeof result.error === 'string') {
          setErrors({ _form: [result.error] })
        } else {
          setErrors(result.error as FieldErrors)
        }
        return
      }

      toast.success('Expense added')
      router.push(`/seasons/${seasonId}/expenses`)
    })
  }

  return (
    <form action={handleSubmit} className="flex flex-col gap-5">
      {/* Category */}
      <div className="flex flex-col gap-1.5">
        <Label>Category</Label>
        <Select
          value={category}
          onValueChange={(v) => setCategory(v as ExpenseCategory)}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select category" />
          </SelectTrigger>
          <SelectContent>
            {EXPENSE_CATEGORIES.map((c) => (
              <SelectItem key={c.value} value={c.value}>
                {c.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.category && (
          <p className="text-sm text-destructive">{errors.category[0]}</p>
        )}
      </div>

      {/* Amount */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="amount">Amount (PKR)</Label>
        <Input
          id="amount"
          type="number"
          min="0"
          step="any"
          placeholder="0"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          required
        />
        {errors.amount && (
          <p className="text-sm text-destructive">{errors.amount[0]}</p>
        )}

        {/* Duty split preview */}
        {dutySplitPreview && (
          <div className="rounded-md border border-dashed px-3 py-2 text-sm">
            {dutySplitPreview.type === 'split' ? (
              <div className="flex flex-col gap-1">
                <span>
                  Landlord pays:{' '}
                  <span className="font-medium">
                    Rs.{' '}
                    {dutySplitPreview.landlordCost.toLocaleString('en-PK')}{' '}
                    ({dutySplitPreview.landlordPct}%)
                  </span>
                </span>
                <span>
                  Contractor pays:{' '}
                  <span className="font-medium">
                    Rs.{' '}
                    {dutySplitPreview.contractorCost.toLocaleString('en-PK')}{' '}
                    ({dutySplitPreview.contractorPct}%)
                  </span>
                </span>
              </div>
            ) : (
              <span className="text-muted-foreground">
                100% landlord expense
              </span>
            )}
          </div>
        )}
      </div>

      {/* Date */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="expense_date">Date</Label>
        <Input
          id="expense_date"
          type="date"
          value={expenseDate}
          onChange={(e) => setExpenseDate(e.target.value)}
          required
        />
        {errors.expense_date && (
          <p className="text-sm text-destructive">{errors.expense_date[0]}</p>
        )}
      </div>

      {/* Farm (optional) */}
      <div className="flex flex-col gap-1.5">
        <Label>Farm (optional)</Label>
        <Select value={farmId} onValueChange={(v) => setFarmId(v ?? '')}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="No specific farm" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">No specific farm</SelectItem>
            {farms.map((farm) => (
              <SelectItem key={farm.id} value={farm.id}>
                {farm.name} ({farm.acreage} acres)
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Description */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="description">Description (optional)</Label>
        <textarea
          id="description"
          className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          placeholder="Any notes about this expense"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>

      {/* Photo */}
      <div className="flex flex-col gap-1.5">
        <Label>Receipt photo (optional)</Label>
        <PhotoUpload
          name="photo"
          pathPrefix={`${userId}/${seasonId}/expenses`}
          onChange={setPhotoPath}
        />
      </div>

      {/* Form-level errors */}
      {errors._form && (
        <p className="text-sm text-destructive">{errors._form[0]}</p>
      )}

      {/* Submit */}
      <Button type="submit" disabled={isPending}>
        {isPending ? 'Saving...' : 'Add Expense'}
      </Button>
    </form>
  )
}
