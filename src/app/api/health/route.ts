import { connection } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Columns of `seasons` the app depends on. PostgREST errors when a selected
// column (or the table) does not exist, so this query fails when a migration
// has not reached the database — e.g. start_date/end_date after PR #21.
// When a migration adds columns the app depends on, add them here.
const SEASONS_COLUMNS = 'id, start_date, end_date'

const TIMEOUT_MS = 5_000

const NO_STORE = { 'Cache-Control': 'no-store' }

// Railway healthcheck: 200 when the app's expected schema is queryable,
// 503 otherwise. Public endpoint — never echo error details or env values.
export async function GET() {
  // Never prerender: CI builds with placeholder Supabase env.
  await connection()

  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!url || !anonKey) {
      throw new Error('NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY is not set')
    }

    const supabase = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    // With the anon key RLS returns zero rows; only an error matters here.
    const { error } = await supabase
      .from('seasons')
      .select(SEASONS_COLUMNS)
      .limit(1)
      .abortSignal(AbortSignal.timeout(TIMEOUT_MS))
    if (error) throw new Error(error.message)

    return Response.json({ ok: true }, { headers: NO_STORE })
  } catch (err) {
    console.error('[health] check failed:', err instanceof Error ? err.message : err)
    return Response.json({ ok: false }, { status: 503, headers: NO_STORE })
  }
}
