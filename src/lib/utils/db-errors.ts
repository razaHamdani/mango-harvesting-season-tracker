// SQLSTATE raised by the closed-season triggers
// (supabase/migrations/20261120120000_closed_season_frozen.sql).
export const SEASON_CLOSED_CODE = '55000'
export const SEASON_CLOSED_MESSAGE = 'This season is closed.'

export function isSeasonClosedError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    (err as { code?: unknown }).code === SEASON_CLOSED_CODE
  )
}
