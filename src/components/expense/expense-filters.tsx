'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useCallback } from 'react'
import { Zap, Sparkles, Leaf, User, Package } from 'lucide-react'
import type { Farm } from '@/types/database'
import { cn } from '@/lib/utils'
import { formatPKR } from '@/lib/utils/format'

const CATEGORY_CHIPS = [
  { key: 'electricity', label: 'Electricity', icon: Zap },
  { key: 'spray', label: 'Spray', icon: Sparkles },
  { key: 'fertilizer', label: 'Fertilizer', icon: Leaf },
  { key: 'labor', label: 'Labor', icon: User },
  { key: 'misc', label: 'Misc', icon: Package },
]

interface ExpenseFiltersProps {
  farms: Farm[]
  amounts: Record<string, number>
}

export function ExpenseFilters({ farms, amounts }: ExpenseFiltersProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const category = searchParams.get('category') ?? ''
  const farmId = searchParams.get('farmId') ?? ''
  const dateFrom = searchParams.get('dateFrom') ?? ''
  const dateTo = searchParams.get('dateTo') ?? ''

  const updateParam = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString())
      if (value) params.set(key, value)
      else params.delete(key)
      router.push(`${pathname}?${params.toString()}`)
    },
    [router, pathname, searchParams],
  )

  const toggleCategory = useCallback(
    (k: string) => updateParam('category', category === k ? '' : k),
    [updateParam, category],
  )

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap gap-2">
        {CATEGORY_CHIPS.map(({ key, label, icon: Icon }) => {
          const isActive = category === key
          return (
            <button
              key={key}
              type="button"
              onClick={() => toggleCategory(key)}
              className={cn('chip', isActive && 'active')}
              aria-pressed={isActive}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
              <span className="chip__count mono tnum">
                {formatPKR(amounts[key] ?? 0)}
              </span>
            </button>
          )
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <select
          value={farmId}
          onChange={(e) => updateParam('farmId', e.target.value)}
          aria-label="Filter by farm"
          className="h-8 rounded-lg border border-[color:var(--border)] bg-transparent px-2.5 text-sm outline-none focus-visible:border-[color:var(--mango)] focus-visible:ring-3 focus-visible:ring-[color:var(--mango)]/30"
        >
          <option value="">All farms</option>
          {farms.map((farm) => (
            <option key={farm.id} value={farm.id}>
              {farm.name}
            </option>
          ))}
        </select>
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => updateParam('dateFrom', e.target.value)}
          aria-label="From date"
          className="h-8 rounded-lg border border-[color:var(--border)] bg-transparent px-2.5 text-sm outline-none focus-visible:border-[color:var(--mango)] focus-visible:ring-3 focus-visible:ring-[color:var(--mango)]/30"
        />
        <input
          type="date"
          value={dateTo}
          onChange={(e) => updateParam('dateTo', e.target.value)}
          aria-label="To date"
          className="h-8 rounded-lg border border-[color:var(--border)] bg-transparent px-2.5 text-sm outline-none focus-visible:border-[color:var(--mango)] focus-visible:ring-3 focus-visible:ring-[color:var(--mango)]/30"
        />
      </div>
    </div>
  )
}
