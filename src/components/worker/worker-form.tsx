'use client'

import { useRef, useState, useTransition } from 'react'
import type { Worker } from '@/types/database'
import { createWorker, updateWorker } from '@/lib/actions/worker-actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface WorkerFormProps {
  worker?: Worker
  onSuccess: () => void
}

type FieldErrors = {
  name?: string[]
  phone?: string[]
  monthly_salary?: string[]
  _form?: string[]
}

export function WorkerForm({ worker, onSuccess }: WorkerFormProps) {
  const formRef = useRef<HTMLFormElement>(null)
  const [isPending, startTransition] = useTransition()
  const [errors, setErrors] = useState<FieldErrors>({})

  async function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = worker
        ? await updateWorker(worker.id, formData)
        : await createWorker(formData)

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
        <Label htmlFor="name">Name</Label>
        <Input
          id="name"
          name="name"
          type="text"
          placeholder="Worker name"
          defaultValue={worker?.name ?? ''}
          required
        />
        {errors.name && (
          <p className="text-sm text-destructive">{errors.name[0]}</p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="phone">Phone (optional)</Label>
        <Input
          id="phone"
          name="phone"
          type="text"
          placeholder="Phone number"
          defaultValue={worker?.phone ?? ''}
        />
        {errors.phone && (
          <p className="text-sm text-destructive">{errors.phone[0]}</p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="monthly_salary">Monthly Salary (Rs.)</Label>
        <Input
          id="monthly_salary"
          name="monthly_salary"
          type="number"
          step="0.01"
          min="1"
          placeholder="e.g. 25000"
          defaultValue={worker?.monthly_salary ?? ''}
          required
        />
        {errors.monthly_salary && (
          <p className="text-sm text-destructive">{errors.monthly_salary[0]}</p>
        )}
      </div>

      {errors._form && (
        <p className="text-sm text-destructive">{errors._form[0]}</p>
      )}

      <Button type="submit" disabled={isPending}>
        {isPending
          ? worker
            ? 'Updating...'
            : 'Adding...'
          : worker
            ? 'Update Worker'
            : 'Add Worker'}
      </Button>
    </form>
  )
}
