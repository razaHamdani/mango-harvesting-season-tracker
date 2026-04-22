'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import type { Farm, Season, ActivityType } from '@/types/database'
import { createActivity } from '@/lib/actions/activity-actions'
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

interface ActivityFormProps {
  seasonId: string
  farms: Farm[]
  season: Pick<Season, 'id' | 'year'>
  userId: string
}

const ACTIVITY_TYPES: { value: ActivityType; label: string }[] = [
  { value: 'spray', label: 'Spray' },
  { value: 'water', label: 'Water' },
  { value: 'fertilize', label: 'Fertilize' },
  { value: 'harvest', label: 'Harvest' },
]

type FieldErrors = Record<string, string[] | undefined>

export function ActivityForm({ seasonId, farms, userId }: ActivityFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [errors, setErrors] = useState<FieldErrors>({})

  const [type, setType] = useState<ActivityType>('spray')
  const [farmId, setFarmId] = useState('')
  const [activityDate, setActivityDate] = useState(
    new Date().toISOString().split('T')[0]
  )
  const [itemName, setItemName] = useState('')
  const [meterReading, setMeterReading] = useState('')
  const [boxesCollected, setBoxesCollected] = useState('')
  const [description, setDescription] = useState('')
  const [photoPath, setPhotoPath] = useState<string | null>(null)

  function handleSubmit() {
    startTransition(async () => {
      const formData = new FormData()
      formData.set('type', type)
      formData.set('farm_id', farmId)
      formData.set('activity_date', activityDate)
      formData.set('item_name', itemName)
      formData.set('description', description)

      if (type === 'water' && meterReading) {
        formData.set('meter_reading', meterReading)
      }

      if (type === 'harvest' && boxesCollected) {
        formData.set('boxes_collected', boxesCollected)
      }

      if (photoPath) {
        formData.set('photo_path', photoPath)
      }

      const result = await createActivity(formData, seasonId)

      if (result.error) {
        if (typeof result.error === 'string') {
          setErrors({ _form: [result.error] })
        } else {
          setErrors(result.error as FieldErrors)
        }
        return
      }

      toast.success('Activity logged', {
        description: 'Also log an expense for this activity?',
        action: {
          label: 'Add Expense',
          onClick: () => {
            router.push(`/seasons/${seasonId}/expenses/new?activity_id=${result.activityId}`)
          },
        },
      })

      router.push(`/seasons/${seasonId}/activities`)
    })
  }

  return (
    <form action={handleSubmit} className="flex flex-col gap-5">
      {/* Activity Type */}
      <div className="flex flex-col gap-1.5">
        <Label>Activity Type</Label>
        <div className="flex gap-2">
          {ACTIVITY_TYPES.map((t) => (
            <Button
              key={t.value}
              type="button"
              variant={type === t.value ? 'default' : 'outline'}
              size="sm"
              onClick={() => setType(t.value)}
            >
              {t.label}
            </Button>
          ))}
        </div>
        {errors.type && (
          <p className="text-sm text-destructive">{errors.type[0]}</p>
        )}
      </div>

      {/* Farm Selector */}
      <div className="flex flex-col gap-1.5">
        <Label>Farm</Label>
        <Select value={farmId} onValueChange={(v) => setFarmId(v ?? '')}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select a farm" />
          </SelectTrigger>
          <SelectContent>
            {farms.map((farm) => (
              <SelectItem key={farm.id} value={farm.id}>
                {farm.name} ({farm.acreage} acres)
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.farm_id && (
          <p className="text-sm text-destructive">{errors.farm_id[0]}</p>
        )}
      </div>

      {/* Date */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="activity_date">Date</Label>
        <Input
          id="activity_date"
          type="date"
          value={activityDate}
          onChange={(e) => setActivityDate(e.target.value)}
          required
        />
        {errors.activity_date && (
          <p className="text-sm text-destructive">{errors.activity_date[0]}</p>
        )}
      </div>

      {/* Spray: Chemical/Spray Name */}
      {type === 'spray' && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="item_name">Chemical / Spray Name</Label>
          <Input
            id="item_name"
            type="text"
            placeholder="e.g. Confidor"
            value={itemName}
            onChange={(e) => setItemName(e.target.value)}
          />
        </div>
      )}

      {/* Water: Meter Reading */}
      {type === 'water' && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="meter_reading">Meter Reading</Label>
          <Input
            id="meter_reading"
            type="number"
            step="any"
            placeholder="Optional"
            value={meterReading}
            onChange={(e) => setMeterReading(e.target.value)}
          />
        </div>
      )}

      {/* Fertilize: Fertilizer Name */}
      {type === 'fertilize' && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="item_name">Fertilizer Name</Label>
          <Input
            id="item_name"
            type="text"
            placeholder="e.g. DAP"
            value={itemName}
            onChange={(e) => setItemName(e.target.value)}
          />
        </div>
      )}

      {/* Harvest: Boxes Collected */}
      {type === 'harvest' && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="boxes_collected">Boxes Received from Contractor</Label>
          <Input
            id="boxes_collected"
            type="number"
            min="0"
            step="1"
            placeholder="Number of boxes"
            value={boxesCollected}
            onChange={(e) => setBoxesCollected(e.target.value)}
          />
        </div>
      )}

      {/* Description */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="description">Description (optional)</Label>
        <textarea
          id="description"
          className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          placeholder="Any notes about this activity"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>

      {/* Photo */}
      <div className="flex flex-col gap-1.5">
        <Label>Photo (optional)</Label>
        <PhotoUpload
          name="photo"
          pathPrefix={`${userId}/${seasonId}/activities`}
          onChange={setPhotoPath}
        />
      </div>

      {/* Form-level errors */}
      {errors._form && (
        <p className="text-sm text-destructive">{errors._form[0]}</p>
      )}

      {/* Submit */}
      <Button type="submit" disabled={isPending}>
        {isPending ? 'Saving...' : 'Log Activity'}
      </Button>
    </form>
  )
}
