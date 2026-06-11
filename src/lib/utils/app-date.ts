/**
 * "Today" in the business timezone.
 *
 * Dates in this app record farm events (expenses, activities, payments), so
 * the farm's timezone — not the server's or the viewer's — is the correct
 * anchor. The server runs in UTC: between 00:00 and 05:00 PKT a UTC "today"
 * is still yesterday, so entering today's local date would be rejected as
 * "in the future".
 *
 * Used by assertWithinSeasonWindow (future-date cap) and activateSeason
 * (started_at stamp). Override with APP_TIMEZONE for farms elsewhere.
 */
const DEFAULT_TIMEZONE = 'Asia/Karachi'

export function todayInAppTz(): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: process.env.APP_TIMEZONE || DEFAULT_TIMEZONE,
  }).format(new Date())
}
