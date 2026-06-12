/**
 * S1 — unpaid/underpaid semantics live in exactly one place.
 *
 * unpaid    = paid_amount IS NULL
 * underpaid = recorded but paid_amount < expected_amount
 * shortfall = Σ max(0, expected − paid) over recorded rows
 * Overpayment is never counted or warned about.
 */
import { describe, it, expect } from 'vitest'
import {
  summarizeInstallments,
  buildCloseWarning,
} from '@/lib/utils/installment-shortfall'

function row(expected: number, paid: number | null) {
  return { expected_amount: expected, paid_amount: paid }
}

describe('summarizeInstallments', () => {
  it('empty list → all zeros', () => {
    expect(summarizeInstallments([])).toEqual({
      unpaidCount: 0,
      underpaidCount: 0,
      shortfallTotal: 0,
    })
  })

  it('all paid in full → all zeros', () => {
    const summary = summarizeInstallments([row(50_000, 50_000), row(25_000, 25_000)])
    expect(summary).toEqual({ unpaidCount: 0, underpaidCount: 0, shortfallTotal: 0 })
  })

  it('unpaid rows are counted, not summed into shortfall', () => {
    const summary = summarizeInstallments([row(50_000, null), row(25_000, null)])
    expect(summary).toEqual({ unpaidCount: 2, underpaidCount: 0, shortfallTotal: 0 })
  })

  it('underpaid rows count and accumulate the gap', () => {
    const summary = summarizeInstallments([
      row(50_000, 40_000), // short 10,000
      row(25_000, 20_000), // short 5,000
    ])
    expect(summary).toEqual({
      unpaidCount: 0,
      underpaidCount: 2,
      shortfallTotal: 15_000,
    })
  })

  it('mixed unpaid + underpaid + settled', () => {
    const summary = summarizeInstallments([
      row(50_000, null),
      row(25_000, 20_000),
      row(10_000, 10_000),
    ])
    expect(summary).toEqual({
      unpaidCount: 1,
      underpaidCount: 1,
      shortfallTotal: 5_000,
    })
  })

  it('overpayment is not counted and does not offset shortfall', () => {
    const summary = summarizeInstallments([
      row(50_000, 60_000), // over by 10,000 — ignored
      row(25_000, 20_000), // short 5,000
    ])
    expect(summary).toEqual({
      unpaidCount: 0,
      underpaidCount: 1,
      shortfallTotal: 5_000,
    })
  })

  it('a zero payment is underpaid, not unpaid', () => {
    const summary = summarizeInstallments([row(50_000, 0)])
    expect(summary).toEqual({
      unpaidCount: 0,
      underpaidCount: 1,
      shortfallTotal: 50_000,
    })
  })
})

describe('buildCloseWarning', () => {
  it('null when nothing to warn about', () => {
    expect(
      buildCloseWarning({ unpaidCount: 0, underpaidCount: 0, shortfallTotal: 0 })
    ).toBeNull()
  })

  it('unpaid only, singular', () => {
    expect(
      buildCloseWarning({ unpaidCount: 1, underpaidCount: 0, shortfallTotal: 0 })
    ).toBe('1 installment still unpaid.')
  })

  it('unpaid only, plural', () => {
    expect(
      buildCloseWarning({ unpaidCount: 2, underpaidCount: 0, shortfallTotal: 0 })
    ).toBe('2 installments still unpaid.')
  })

  it('underpaid only, singular, includes PKR shortfall', () => {
    expect(
      buildCloseWarning({ unpaidCount: 0, underpaidCount: 1, shortfallTotal: 10_000 })
    ).toBe('1 installment underpaid (short Rs. 10,000).')
  })

  it('mixed unpaid + underpaid', () => {
    expect(
      buildCloseWarning({ unpaidCount: 2, underpaidCount: 1, shortfallTotal: 10_000 })
    ).toBe('2 installments still unpaid, 1 underpaid (short Rs. 10,000).')
  })
})
