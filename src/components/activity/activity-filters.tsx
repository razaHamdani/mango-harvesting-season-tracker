'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useCallback } from 'react'
import type { Farm } from '@/types/database'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const ACTIVITY_TYPES = [
  { value: '', label: 'All Types' },
  { value: 'spray', label: 'Spray' },
  { value: 'water', label: 'Water' },
  { value: 'fertilize', label: 'Fertilize' },
  { value: 'harvest', label: 'Harvest' },
]

interface ActivityFiltersProps {
  farms: Farm[]
}

export function ActivityFilters({ farms }: ActivityFiltersProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const type = searchParams.get('type') ?? ''
  const farmId = searchParams.get('farmId') ?? ''
  const dateFrom = searchParams.get('dateFrom') ?? ''
  const dateTo = searchParams.get('dateTo') ?? ''

  const hasFilters = type || farmId || dateFrom || dateTo

  const updateParam = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString())
      if (value) {
        params.set(key, value)
      } else {
        params.delete(key)
      }
      router.push(`${pathname}?${params.toString()}`)
    },
    [router, pathname, searchParams]
  )

  const clearFilters = useCallback(() => {
    router.push(pathname)
  }, [router, pathname])

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="space-y-1">
        <Label htmlFor="filter-type">Type</Label>
        <select
          id="filter-type"
          value={type}
          onChange={(e) => updateParam('type', e.target.value)}
          className="flex h-8 w-[140px] items-center rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
        >
          {ACTIVITY_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1">
        <Label htmlFor="filter-farm">Farm</Label>
        <select
          id="filter-farm"
          value={farmId}
          onChange={(e) => updateParam('farmId', e.target.value)}
          className="flex h-8 w-[160px] items-center rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
        >
          <option value="">All Farms</option>
          {farms.map((farm) => (
            <option key={farm.id} value={farm.id}>
              {farm.name}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1">
        <Label htmlFor="filter-date-from">From</Label>
        <Input
          id="filter-date-from"
          type="date"
          value={dateFrom}
          onChange={(e) => updateParam('dateFrom', e.target.value)}
          className="h-8 w-[150px]"
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor="filter-date-to">To</Label>
        <Input
          id="filter-date-to"
          type="date"
          value={dateTo}
          onChange={(e) => updateParam('dateTo', e.target.value)}
          className="h-8 w-[150px]"
        />
      </div>

      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={clearFilters}>
          Clear Filters
        </Button>
      )}
    </div>
  )
}
