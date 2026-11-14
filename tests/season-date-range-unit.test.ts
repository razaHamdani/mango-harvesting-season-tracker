/**
 * Season date range — DB-free checks of the create-form schema and the
 * season label. Must not import tests/helpers (those require a local Supabase).
 */
import { describe, it, expect } from 'vitest'
import { seasonCreateSchema } from '@/lib/utils/validators'
import { formatSeasonLabel } from '@/lib/utils/season-label'

const VALID = {
  start_date: '2026-01-05',
  end_date: '2026-05-30',
  contractor_name: 'Test Contractor',
  predetermined_amount: 100_000,
  spray_landlord_pct: 50,
  fertilizer_landlord_pct: 50,
  agreed_boxes: 0,
  farm_ids: ['11111111-1111-4111-8111-111111111111'],
  installments: [
    { amount: 50_000, due_date: '2026-02-01' },
    { amount: 50_000, due_date: '2026-05-30' },
  ],
}

function fieldErrors(input: unknown) {
  const parsed = seasonCreateSchema.safeParse(input)
  expect(parsed.success).toBe(false)
  if (parsed.success) throw new Error('expected a parse failure')
  return parsed.error.flatten().fieldErrors as Record<string, string[] | undefined>
}

describe('seasonCreateSchema — date range', () => {
  it('accepts a valid range with due dates inside it (bounds inclusive)', () => {
    const parsed = seasonCreateSchema.safeParse(VALID)
    expect(parsed.success).toBe(true)
  })

  it('rejects end_date before start_date', () => {
    const errors = fieldErrors({ ...VALID, start_date: '2026-05-30', end_date: '2026-01-05' })
    expect(errors.end_date).toEqual(['End date must be after start date.'])
  })

  it('rejects end_date equal to start_date', () => {
    const errors = fieldErrors({ ...VALID, start_date: '2026-03-01', end_date: '2026-03-01' })
    expect(errors.end_date).toEqual(['End date must be after start date.'])
  })

  it('rejects a due date after end_date', () => {
    const errors = fieldErrors({
      ...VALID,
      installments: [
        { amount: 50_000, due_date: '2026-02-01' },
        { amount: 50_000, due_date: '2026-05-31' },
      ],
    })
    expect(errors.installments?.[0]).toMatch(/within the season \(2026-01-05 to 2026-05-30\)/)
  })

  it('rejects a due date before start_date', () => {
    const errors = fieldErrors({
      ...VALID,
      installments: [
        { amount: 50_000, due_date: '2026-01-04' },
        { amount: 50_000, due_date: '2026-02-01' },
      ],
    })
    expect(errors.installments?.[0]).toMatch(/within the season/)
  })

  it('rejects a malformed start_date', () => {
    const errors = fieldErrors({ ...VALID, start_date: '2026-1-5' })
    expect(errors.start_date?.[0]).toMatch(/valid date/i)
  })

  it('no longer takes a year', () => {
    const parsed = seasonCreateSchema.safeParse({ ...VALID, year: 2026 })
    expect(parsed.success).toBe(true)
    if (parsed.success) expect(parsed.data).not.toHaveProperty('year')
  })
})

describe('formatSeasonLabel', () => {
  it('formats a same-year range with the year once', () => {
    expect(formatSeasonLabel({ start_date: '2026-01-05', end_date: '2026-05-30' })).toBe(
      'Jan 5 – May 30, 2026',
    )
  })

  it('formats a cross-year range with both years', () => {
    expect(formatSeasonLabel({ start_date: '2026-11-05', end_date: '2027-02-02' })).toBe(
      'Nov 5, 2026 – Feb 2, 2027',
    )
  })

  it('formats a full calendar year', () => {
    expect(formatSeasonLabel({ start_date: '2026-01-01', end_date: '2026-12-31' })).toBe(
      'Jan 1 – Dec 31, 2026',
    )
  })
})
