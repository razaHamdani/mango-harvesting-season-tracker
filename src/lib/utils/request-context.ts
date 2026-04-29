import { headers } from 'next/headers'
import * as Sentry from '@sentry/nextjs'

/**
 * Attach the per-request requestId tag to the current Sentry scope.
 *
 * Sentry v10's `getCurrentScope()` returns a per-async-context scope (not the
 * global hub), so this is safe under concurrent requests on the same Node
 * process. Read the value from next/headers — Sentry's auto request-data
 * integration does NOT reliably capture middleware-injected headers for
 * Server Action errors, so beforeSend cannot stand on its own.
 *
 * Called inside createClient() so every Server Action / Server Component
 * that uses the supabase server client gets the tag for free.
 */
export async function attachRequestContext(): Promise<void> {
  try {
    const requestId = (await headers()).get('x-request-id')
    if (requestId) {
      Sentry.getCurrentScope().setTag('requestId', requestId)
    }
  } catch {
    // headers() is unavailable outside a request scope (e.g. during tests
    // or background jobs). Silently no-op.
  }
}
