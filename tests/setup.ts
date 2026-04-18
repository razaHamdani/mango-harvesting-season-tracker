import { vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'

// ---------------------------------------------------------------
// Per-test Supabase client injection.
//
// Server actions call `createClient()` from '@/lib/supabase/server',
// which internally uses next/headers cookies() -- not available in
// Vitest. We replace that module with a factory that returns whatever
// client the current test has set via `setCurrentClient()`.
// ---------------------------------------------------------------

let currentClient: SupabaseClient | null = null

export function setCurrentClient(client: SupabaseClient): void {
  currentClient = client
}

export function clearCurrentClient(): void {
  currentClient = null
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => {
    if (!currentClient) {
      throw new Error(
        'No test client set. Call setCurrentClient(user.client) in beforeEach.'
      )
    }
    return currentClient
  },
}))

// `revalidatePath` has no meaning outside a Next.js request -- stub it.
vi.mock('next/cache', () => ({
  revalidatePath: () => {},
  revalidateTag: () => {},
}))
