import type { Client } from 'pg'

// Refuses to let the test suite touch anything but the local Supabase stack.
// Error messages name the variable and the rule, never the value: a URL can
// carry a password.

const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]'])
const API_PORT = '54321'
const DB_PORT = '54322'
const DB_PATH = '/postgres'

// Database comment set only by supabase/seed.sql, which runs on local
// `supabase start` / `db reset` and is never pushed to production.
export const MARKER_VALUE = 'aam-daata local test target'

type Env = Record<string, string | undefined>

function parse(name: string, value: string | undefined): URL {
  if (!value) throw new Error(`Test guard: ${name} is missing.`)
  try {
    return new URL(value)
  } catch {
    throw new Error(`Test guard: ${name} is not a valid URL.`)
  }
}

function requireLocalHost(name: string, url: URL): void {
  if (!LOCAL_HOSTS.has(url.hostname)) {
    throw new Error(
      `Test guard: ${name} host must be exactly 127.0.0.1, localhost or [::1].`
    )
  }
}

export function assertLocalTargetSync(env: Env = process.env): void {
  const api = parse('NEXT_PUBLIC_SUPABASE_URL', env.NEXT_PUBLIC_SUPABASE_URL)
  if (api.protocol !== 'http:') {
    throw new Error('Test guard: NEXT_PUBLIC_SUPABASE_URL must use http:.')
  }
  requireLocalHost('NEXT_PUBLIC_SUPABASE_URL', api)
  if (api.port !== API_PORT) {
    throw new Error(`Test guard: NEXT_PUBLIC_SUPABASE_URL port must be ${API_PORT}.`)
  }

  const db = parse('SUPABASE_DB_URL', env.SUPABASE_DB_URL)
  if (db.protocol !== 'postgres:' && db.protocol !== 'postgresql:') {
    throw new Error('Test guard: SUPABASE_DB_URL must use postgres: or postgresql:.')
  }
  requireLocalHost('SUPABASE_DB_URL', db)
  if (db.port !== DB_PORT) {
    throw new Error(`Test guard: SUPABASE_DB_URL port must be ${DB_PORT}.`)
  }
  if (db.pathname !== DB_PATH) {
    throw new Error(`Test guard: SUPABASE_DB_URL database must be ${DB_PATH}.`)
  }
  // pg honours these query parameters over the URL's own host.
  for (const key of db.searchParams.keys()) {
    if (key.toLowerCase() === 'host' || key.toLowerCase() === 'hostaddr') {
      throw new Error(`Test guard: SUPABASE_DB_URL must not set ${key.toLowerCase()} in its query.`)
    }
  }
}

export async function assertLocalDatabase(pg: Client): Promise<void> {
  const { rows } = await pg.query<{ v: string | null }>(
    `select shobj_description(oid, 'pg_database') as v
       from pg_database where datname = current_database()`
  )
  if (rows[0]?.v !== MARKER_VALUE) {
    throw new Error(
      'Test guard: the database is not the local test stack (seed marker missing). ' +
        'Run `npx supabase db reset` locally; never point tests at another database.'
    )
  }
}
