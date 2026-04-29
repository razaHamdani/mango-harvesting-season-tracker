import { headers } from 'next/headers'

/**
 * Structured error logger for Server Actions and Server Components.
 *
 * Prefixes every log line with the request ID set by the proxy, which makes
 * a single user request traceable across:
 *   - the proxy log line (with request ID + path)
 *   - any Server Action logs raised during that request
 *   - the response headers (x-request-id) the user can copy from devtools
 *
 * Sentry (configured in sentry.server.config.ts) captures the err separately
 * via console.error interception.
 *
 * Usage:
 *   await logError('createExpense', err)
 *   // → "[createExpense] req=a1b2c3d4 ..."
 */
export async function logError(scope: string, err: unknown): Promise<void> {
  let reqId = '?'
  try {
    reqId = (await headers()).get('x-request-id') ?? '?'
  } catch {
    // headers() is unavailable outside a request scope (e.g. tests).
  }
  console.error(`[${scope}] req=${reqId}`, err)
}
