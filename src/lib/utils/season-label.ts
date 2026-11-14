import { todayInAppTz } from '@/lib/utils/app-date'

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

// Parses YYYY-MM-DD by hand: no Date, so no locale or timezone dependence.
function parseIsoDate(iso: string): { year: number; month: number; day: number } {
  const [y, m, d] = iso.slice(0, 10).split('-')
  return { year: Number(y), month: Number(m), day: Number(d) }
}

/**
 * Labels a season by its date range.
 *   same year:       'Jan 5 – May 30, 2026'
 *   different years: 'Nov 5, 2026 – Feb 2, 2027'
 */
export function formatSeasonLabel({
  start_date,
  end_date,
}: {
  start_date: string
  end_date: string
}): string {
  const s = parseIsoDate(start_date)
  const e = parseIsoDate(end_date)
  const startMd = `${MONTHS[s.month - 1]} ${s.day}`
  const endMd = `${MONTHS[e.month - 1]} ${e.day}`
  if (s.year === e.year) {
    return `${startMd} – ${endMd}, ${e.year}`
  }
  return `${startMd}, ${s.year} – ${endMd}, ${e.year}`
}

/**
 * Whole days from the season's start_date to today in the business timezone
 * (0 on the start day, never negative). Both dates are calendar dates, so the
 * difference is taken in UTC to stay clear of DST shifts.
 */
export function daysSinceSeasonStart(startDate: string): number {
  const s = parseIsoDate(startDate)
  const t = parseIsoDate(todayInAppTz())
  const diff =
    (Date.UTC(t.year, t.month - 1, t.day) - Date.UTC(s.year, s.month - 1, s.day)) /
    86400000
  return Math.max(0, diff)
}
