import { formatPKR } from '@/lib/utils/format'

/**
 * Single source of truth for unpaid/underpaid installment semantics (S1).
 *
 * The schema records one payment per installment; `paid_amount IS NULL` is
 * the only DB-level "unpaid" signal, so a short payment would otherwise
 * masquerade as settled. Every surface that reports payment health (payments
 * tab, close-season warning, close confirm) derives its numbers from here.
 *
 * - unpaid:    paid_amount is null (never recorded)
 * - underpaid: paid_amount < expected_amount (recorded short)
 * - shortfall: Σ max(0, expected − paid) over recorded rows
 *
 * Overpayment is deliberately NOT counted — it is display-only trivia.
 *
 * Plain JS over fetched rows: PostgREST cannot compare two columns in a
 * filter, and a season has only a handful of installments.
 */

export type InstallmentAmounts = {
  expected_amount: number
  paid_amount: number | null
}

export type InstallmentSummary = {
  unpaidCount: number
  underpaidCount: number
  shortfallTotal: number
}

export function summarizeInstallments(
  rows: InstallmentAmounts[],
): InstallmentSummary {
  let unpaidCount = 0
  let underpaidCount = 0
  let shortfallTotal = 0

  for (const row of rows) {
    if (row.paid_amount === null) {
      unpaidCount++
      continue
    }
    const gap = row.expected_amount - row.paid_amount
    if (gap > 0) {
      underpaidCount++
      shortfallTotal += gap
    }
  }

  return { unpaidCount, underpaidCount, shortfallTotal }
}

/**
 * Builds the close-season warning from a summary, or null when there is
 * nothing to warn about. Shared by the closeSeason server action and the
 * client-side close confirm so the wording never forks.
 *
 * Shapes:
 *   "2 installments still unpaid."
 *   "1 installment underpaid (short Rs. 10,000)."
 *   "2 installments still unpaid, 1 underpaid (short Rs. 10,000)."
 */
export function buildCloseWarning(summary: InstallmentSummary): string | null {
  const { unpaidCount, underpaidCount, shortfallTotal } = summary

  const unpaidPart =
    unpaidCount > 0
      ? `${unpaidCount} installment${unpaidCount === 1 ? '' : 's'} still unpaid`
      : null
  const underpaidPart =
    underpaidCount > 0
      ? `${unpaidPart ? `${underpaidCount} underpaid` : `${underpaidCount} installment${underpaidCount === 1 ? '' : 's'} underpaid`} (short ${formatPKR(shortfallTotal)})`
      : null

  if (!unpaidPart && !underpaidPart) return null
  return `${[unpaidPart, underpaidPart].filter(Boolean).join(', ')}.`
}
