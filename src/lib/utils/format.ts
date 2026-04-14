/**
 * Format a number as PKR with Pakistani (South Asian) grouping:
 * 850000 -> "Rs. 8,50,000"
 * 12345678 -> "Rs. 1,23,45,678"
 *
 * Intl.NumberFormat's en-IN/ur-PK locales are inconsistent across
 * runtimes, so we implement grouping manually: last 3 digits, then
 * groups of 2 from the right.
 */
export function formatPKR(amount: number | null | undefined): string {
  const n = Number(amount ?? 0)
  const rounded = Math.round(Math.abs(n))
  const sign = n < 0 ? '-' : ''
  const s = String(rounded)

  let grouped: string
  if (s.length <= 3) {
    grouped = s
  } else {
    const last3 = s.slice(-3)
    const rest = s.slice(0, -3)
    // Insert comma every 2 digits from the right in the `rest` portion.
    const restGrouped = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',')
    grouped = `${restGrouped},${last3}`
  }

  return `${sign}Rs. ${grouped}`
}

/**
 * Format a date as "15 Mar 2026".
 */
export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return ''
  const d = typeof date === 'string' ? new Date(date) : date
  if (Number.isNaN(d.getTime())) return ''
  const day = d.getDate()
  const month = d.toLocaleString('en-US', { month: 'short' })
  const year = d.getFullYear()
  return `${day} ${month} ${year}`
}
