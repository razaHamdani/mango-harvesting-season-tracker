'use client'

import { useRef, useState, useTransition } from 'react'
import type { Farm } from '@/types/database'
import { createFarm, updateFarm } from '@/lib/actions/farm-actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface FarmFormProps {
  farm?: Farm
  onSuccess: () => void
}

type FieldErrors = {
  name?: string[]
  acreage?: string[]
  _form?: string[]
}

export function FarmForm({ farm, onSuccess }: FarmFormProps) {
  const formRef = useRef<HTMLFormElement>(null)
  const [isPending, startTransition] = useTransition()
  const [errors, setErrors] = useState<FieldErrors>({})

  async function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = farm
        ? await updateFarm(farm.id, formData)
        : await createFarm(formData)

      if (result.error) {
        setErrors(result.error as FieldErrors)
        return
      }

      onSuccess()
    })
  }

  return (
    <form ref={formRef} action={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="name">Farm Name</Label>
        <Input
          id="name"
          name="name"
          type="text"
          placeholder="e.g. North Orchard"
          defaultValue={farm?.name ?? ''}
          required
        />
        {errors.name && (
          <p className="text-sm text-destructive">{errors.name[0]}</p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="acreage">Acreage</Label>
        <Input
          id="acreage"
          name="acreage"
          type="number"
          step="0.01"
          min="0.01"
          placeholder="e.g. 12.50"
          defaultValue={farm?.acreage ?? ''}
          required
        />
        {errors.acreage && (
          <p className="text-sm text-destructive">{errors.acreage[0]}</p>
        )}
      </div>

      {errors._form && (
        <p className="text-sm text-destructive">{errors._form[0]}</p>
      )}

      <Button type="submit" disabled={isPending}>
        {isPending
          ? farm
            ? 'Updating...'
            : 'Adding...'
          : farm
            ? 'Update Farm'
            : 'Add Farm'}
      </Button>
    </form>
  )
}
