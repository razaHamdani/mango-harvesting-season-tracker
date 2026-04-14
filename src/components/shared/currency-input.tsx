'use client'

import * as React from 'react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { formatPKR } from '@/lib/utils/format'

type CurrencyInputProps = Omit<
  React.ComponentProps<'input'>,
  'value' | 'defaultValue' | 'onChange' | 'type'
> & {
  name: string
  value?: number | string | null
  defaultValue?: number | string | null
  onValueChange?: (value: number | null) => void
}

/**
 * PKR currency input. Renders a number input with a "Rs." prefix
 * and live-formatted preview below. Writes the raw numeric value
 * (as a string) to the underlying form field so server actions
 * receive a plain number.
 */
export function CurrencyInput({
  name,
  value,
  defaultValue,
  onValueChange,
  className,
  ...props
}: CurrencyInputProps) {
  const isControlled = value !== undefined
  const [internal, setInternal] = React.useState<string>(() =>
    defaultValue == null ? '' : String(defaultValue)
  )
  const raw = isControlled ? (value == null ? '' : String(value)) : internal
  const numeric = raw === '' ? null : Number(raw)

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const next = e.target.value
    if (!isControlled) setInternal(next)
    onValueChange?.(next === '' ? null : Number(next))
  }

  return (
    <div className="space-y-1">
      <div className="relative">
        <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
          Rs.
        </span>
        <Input
          type="number"
          inputMode="decimal"
          min={0}
          step="0.01"
          name={name}
          value={raw}
          onChange={handleChange}
          className={cn('pl-10', className)}
          {...props}
        />
      </div>
      {numeric !== null && Number.isFinite(numeric) && numeric > 0 && (
        <p className="text-xs text-muted-foreground">{formatPKR(numeric)}</p>
      )}
    </div>
  )
}
