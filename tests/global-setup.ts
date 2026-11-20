import { spawnSync } from 'node:child_process'
import { Client } from 'pg'
import { assertLocalTargetSync, assertLocalDatabase } from './helpers/target-guard'

// Runs once, before any test file. Aborts the whole run unless .env.test
// points at the local Supabase stack that is running right now.

function supabaseStatus(): Record<string, string> {
  // CI has `supabase` on PATH; locally it may only be reachable through npx.
  for (const [cmd, args] of [
    ['supabase', ['status', '-o', 'json']],
    ['npx', ['supabase', 'status', '-o', 'json']],
  ] as const) {
    const r = spawnSync(cmd, [...args], {
      encoding: 'utf8',
      shell: process.platform === 'win32',
    })
    if (r.status === 0 && r.stdout) {
      const json = r.stdout.slice(r.stdout.indexOf('{'))
      try {
        return JSON.parse(json)
      } catch {
        // fall through to the next command
      }
    }
  }
  throw new Error(
    'Test guard: `supabase status` failed. Start the local stack (`npx supabase start`).'
  )
}

function same(a: string | undefined, b: string | undefined): boolean {
  if (!a || !b) return false
  try {
    const ua = new URL(a)
    const ub = new URL(b)
    return ua.hostname === ub.hostname && ua.port === ub.port && ua.pathname === ub.pathname
      && ua.username === ub.username && ua.password === ub.password
  } catch {
    return a === b
  }
}

export default async function setup(): Promise<void> {
  assertLocalTargetSync()

  const status = supabaseStatus()
  // CLI 3.1.0 reports API_URL; 3.2.0 drops it, and the API origin is the
  // origin of STORAGE_S3_URL. The service key is SERVICE_ROLE_KEY (legacy JWT,
  // what CI writes) or SECRET_KEY (sb_secret_…, the newer format).
  let apiUrl: string | undefined = status.API_URL
  if (!apiUrl && status.STORAGE_S3_URL) {
    try {
      apiUrl = new URL(status.STORAGE_S3_URL).origin
    } catch {
      apiUrl = undefined
    }
  }
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const checks: Array<[string, boolean]> = [
    ['NEXT_PUBLIC_SUPABASE_URL', same(process.env.NEXT_PUBLIC_SUPABASE_URL, apiUrl)],
    ['SUPABASE_DB_URL', same(process.env.SUPABASE_DB_URL, status.DB_URL)],
    [
      'SUPABASE_SERVICE_ROLE_KEY',
      !!serviceKey && (serviceKey === status.SERVICE_ROLE_KEY || serviceKey === status.SECRET_KEY),
    ],
  ]
  for (const [name, ok] of checks) {
    if (!ok) {
      throw new Error(
        `Test guard: ${name} in .env.test does not match the running local stack (\`supabase status\`).`
      )
    }
  }

  const pg = new Client({ connectionString: process.env.SUPABASE_DB_URL })
  await pg.connect()
  try {
    await assertLocalDatabase(pg)
  } finally {
    await pg.end()
  }
}
