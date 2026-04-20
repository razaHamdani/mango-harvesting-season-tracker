import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { Client } from 'pg'
import {
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  SUPABASE_DB_URL,
} from './env'

export function createAdminClient(): SupabaseClient {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

export async function resetDb(_admin: SupabaseClient): Promise<void> {
  const pg = new Client({ connectionString: SUPABASE_DB_URL })
  await pg.connect()
  try {
    await pg.query(`
      TRUNCATE expenses, activities, installments, season_farms, seasons, workers, farms, profiles
      RESTART IDENTITY CASCADE
    `)
  } finally {
    await pg.end()
  }
}
