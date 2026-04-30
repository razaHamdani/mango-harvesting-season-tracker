'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { Farm } from '@/types/database'
import { createSeason } from '@/lib/actions/season-actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card'

interface SeasonCreateFormProps {
  farms: Farm[]
}

interface InstallmentRow {
  amount: string
  due_date: string
}

type FieldErrors = Record<string, string[] | undefined>

export function SeasonCreateForm({ farms }: SeasonCreateFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [errors, setErrors] = useState<FieldErrors>({})

  const currentYear = new Date().getFullYear()
  const [year, setYear] = useState(String(currentYear))
  const [contractorName, setContractorName] = useState('')
  const [contractorPhone, setContractorPhone] = useState('')
  const [contractorCnic, setContractorCnic] = useState('')

  const [selectedFarmIds, setSelectedFarmIds] = useState<string[]>([])

  const [predeterminedAmount, setPredeterminedAmount] = useState('')
  const [sprayLandlordPct, setSprayLandlordPct] = useState('100')
  const [fertilizerLandlordPct, setFertilizerLandlordPct] = useState('100')

  const [installments, setInstallments] = useState<InstallmentRow[]>([
    { amount: '', due_date: '' },
  ])

  const [agreedBoxes, setAgreedBoxes] = useState('0')

  function toggleFarm(farmId: string) {
    setSelectedFarmIds((prev) =>
      prev.includes(farmId)
        ? prev.filter((id) => id !== farmId)
        : [...prev, farmId]
    )
  }

  function addInstallment() {
    setInstallments((prev) => [...prev, { amount: '', due_date: '' }])
  }

  function removeInstallment(index: number) {
    if (installments.length <= 1) return
    setInstallments((prev) => prev.filter((_, i) => i !== index))
  }

  function updateInstallment(
    index: number,
    field: keyof InstallmentRow,
    value: string
  ) {
    setInstallments((prev) =>
      prev.map((row, i) => (i === index ? { ...row, [field]: value } : row))
    )
  }

  const installmentTotal = installments.reduce(
    (sum, row) => sum + (parseFloat(row.amount) || 0),
    0
  )
  const predeterminedNum = parseFloat(predeterminedAmount) || 0
  const installmentMismatch =
    predeterminedNum > 0 && Math.abs(installmentTotal - predeterminedNum) >= 0.01

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!e.currentTarget.checkValidity()) {
      e.currentTarget.reportValidity()
      return
    }

    const predNum = parseFloat(predeterminedAmount) || 0
    if (predNum <= 0) {
      setErrors({ predetermined_amount: ['Value must be greater than 0'] })
      return
    }

    setErrors({})

    const payload = {
      year: Number(year),
      contractor_name: contractorName,
      contractor_phone: contractorPhone,
      contractor_cnic: contractorCnic,
      predetermined_amount: Number(predeterminedAmount),
      spray_landlord_pct: Number(sprayLandlordPct),
      fertilizer_landlord_pct: Number(fertilizerLandlordPct),
      agreed_boxes: Number(agreedBoxes),
      farm_ids: selectedFarmIds,
      installments: installments.map((row) => ({
        amount: Number(row.amount),
        due_date: row.due_date,
      })),
    }

    startTransition(async () => {
      const result = await createSeason(payload)

      if (result.error) {
        setErrors(result.error as FieldErrors)
        return
      }

      if (result.id) {
        router.push(`/seasons/${result.id}`)
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {errors._form && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3">
          <p className="text-sm text-destructive">{errors._form[0]}</p>
        </div>
      )}

      {/* Section 1: Basic Info */}
      <Card>
        <CardHeader>
          <CardTitle>Basic Info</CardTitle>
          <CardDescription>Season year and contractor details</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="year">Year</Label>
            <Input
              id="year"
              type="number"
              min={2020}
              max={2100}
              value={year}
              onChange={(e) => setYear(e.target.value)}
              required
            />
            {errors.year && (
              <p className="text-sm text-destructive">{errors.year[0]}</p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="contractor_name">Contractor Name</Label>
            <Input
              id="contractor_name"
              type="text"
              placeholder="e.g. Muhammad Ali"
              value={contractorName}
              onChange={(e) => setContractorName(e.target.value)}
              required
            />
            {errors.contractor_name && (
              <p className="text-sm text-destructive">
                {errors.contractor_name[0]}
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="contractor_phone">
                Contractor Phone{' '}
                <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id="contractor_phone"
                type="text"
                placeholder="e.g. 0300-1234567"
                value={contractorPhone}
                onChange={(e) => setContractorPhone(e.target.value)}
              />
              {errors.contractor_phone && (
                <p className="text-sm text-destructive">
                  {errors.contractor_phone[0]}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="contractor_cnic">
                Contractor CNIC{' '}
                <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id="contractor_cnic"
                type="text"
                placeholder="e.g. 12345-1234567-1"
                value={contractorCnic}
                onChange={(e) => setContractorCnic(e.target.value)}
              />
              {errors.contractor_cnic && (
                <p className="text-sm text-destructive">
                  {errors.contractor_cnic[0]}
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Section 2: Farm Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Farm Selection</CardTitle>
          <CardDescription>
            Select the farms included in this season
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {farms.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No farms found. Add farms first before creating a season.
            </p>
          ) : (
            farms.map((farm) => (
              <label
                key={farm.id}
                className="flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-muted has-[:checked]:border-primary has-[:checked]:bg-primary/5"
              >
                <input
                  type="checkbox"
                  className="size-4 rounded accent-primary"
                  checked={selectedFarmIds.includes(farm.id)}
                  onChange={() => toggleFarm(farm.id)}
                />
                <div>
                  <span className="font-medium">{farm.name}</span>
                  <span className="ml-2 text-sm text-muted-foreground">
                    {farm.acreage} acres
                  </span>
                </div>
              </label>
            ))
          )}
          {errors.farm_ids && (
            <p className="text-sm text-destructive">{errors.farm_ids[0]}</p>
          )}
        </CardContent>
      </Card>

      {/* Section 3: Financial Terms */}
      <Card>
        <CardHeader>
          <CardTitle>Financial Terms</CardTitle>
          <CardDescription>
            Predetermined amount and duty split percentages
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="predetermined_amount">
              Predetermined Amount (PKR)
            </Label>
            <Input
              id="predetermined_amount"
              type="number"
              step="0.01"
              placeholder="e.g. 500000"
              value={predeterminedAmount}
              onChange={(e) => setPredeterminedAmount(e.target.value)}
              required
            />
            {errors.predetermined_amount && (
              <p className="text-sm text-destructive">
                {errors.predetermined_amount[0]}
              </p>
            )}
          </div>

          <Separator />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="spray_landlord_pct">
                Spray Duty: Landlord %
              </Label>
              <Input
                id="spray_landlord_pct"
                type="number"
                min={0}
                max={100}
                value={sprayLandlordPct}
                onChange={(e) => setSprayLandlordPct(e.target.value)}
                required
              />
              <p className="text-sm text-muted-foreground">
                Contractor pays {100 - (parseInt(sprayLandlordPct) || 0)}%
              </p>
              {errors.spray_landlord_pct && (
                <p className="text-sm text-destructive">
                  {errors.spray_landlord_pct[0]}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="fertilizer_landlord_pct">
                Fertilizer Duty: Landlord %
              </Label>
              <Input
                id="fertilizer_landlord_pct"
                type="number"
                min={0}
                max={100}
                value={fertilizerLandlordPct}
                onChange={(e) => setFertilizerLandlordPct(e.target.value)}
                required
              />
              <p className="text-sm text-muted-foreground">
                Contractor pays {100 - (parseInt(fertilizerLandlordPct) || 0)}%
              </p>
              {errors.fertilizer_landlord_pct && (
                <p className="text-sm text-destructive">
                  {errors.fertilizer_landlord_pct[0]}
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Section 4: Payment Schedule */}
      <Card>
        <CardHeader>
          <CardTitle>Payment Schedule</CardTitle>
          <CardDescription>
            Define installment amounts and due dates
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {installments.map((row, index) => (
            <div
              key={index}
              className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-end"
            >
              <div className="flex flex-1 flex-col gap-1.5">
                <Label htmlFor={`installment-amount-${index}`}>
                  Amount (PKR)
                </Label>
                <Input
                  id={`installment-amount-${index}`}
                  type="number"
                  min="0.01"
                  step="0.01"
                  placeholder="e.g. 100000"
                  value={row.amount}
                  onChange={(e) =>
                    updateInstallment(index, 'amount', e.target.value)
                  }
                  required
                />
              </div>
              <div className="flex flex-1 flex-col gap-1.5">
                <Label htmlFor={`installment-date-${index}`}>Due Date</Label>
                <Input
                  id={`installment-date-${index}`}
                  type="date"
                  value={row.due_date}
                  onChange={(e) =>
                    updateInstallment(index, 'due_date', e.target.value)
                  }
                  required
                />
              </div>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                disabled={installments.length <= 1}
                onClick={() => removeInstallment(index)}
              >
                Remove
              </Button>
            </div>
          ))}

          {errors.installments && (
            <p className="text-sm text-destructive">
              {errors.installments[0]}
            </p>
          )}

          <div className="flex items-center justify-between">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addInstallment}
            >
              Add Installment
            </Button>

            <div className="text-right text-sm">
              <span className="text-muted-foreground">Total: </span>
              <span
                className={
                  installmentMismatch
                    ? 'font-medium text-destructive'
                    : 'font-medium'
                }
              >
                PKR {installmentTotal.toLocaleString()}
              </span>
              {predeterminedNum > 0 && (
                <span className="text-muted-foreground">
                  {' '}
                  / {predeterminedNum.toLocaleString()}
                </span>
              )}
            </div>
          </div>

          {installmentMismatch && (
            <p className="text-sm text-destructive">
              Installment total must equal the predetermined amount (PKR{' '}
              {predeterminedNum.toLocaleString()})
            </p>
          )}
        </CardContent>
      </Card>

      {/* Section 5: Mango Box Agreement */}
      <Card>
        <CardHeader>
          <CardTitle>Mango Box Agreement</CardTitle>
          <CardDescription>
            Number of boxes agreed with the contractor
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="agreed_boxes">Agreed Boxes</Label>
            <Input
              id="agreed_boxes"
              type="number"
              min={0}
              value={agreedBoxes}
              onChange={(e) => setAgreedBoxes(e.target.value)}
              required
            />
            {errors.agreed_boxes && (
              <p className="text-sm text-destructive">
                {errors.agreed_boxes[0]}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <Button type="submit" disabled={isPending} className="w-full">
        {isPending ? 'Creating Season...' : 'Create Season'}
      </Button>
    </form>
  )
}
