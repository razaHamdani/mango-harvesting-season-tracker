import * as Sentry from '@sentry/nextjs'

// Server-side Sentry init. Captures uncaught errors in Server Components,
// Server Actions, route handlers, and the proxy. console.error is also
// captured via the Console integration when a DSN is set.
//
// SENTRY_DSN is the only required env var in production. Leave it unset in
// local dev — Sentry SDK becomes a no-op.
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  enabled: Boolean(process.env.SENTRY_DSN),

  // Adjust if traffic grows; tens of users per minute keeps this within free-tier quota.
  tracesSampleRate: 0.1,

  // Don't send PII. Server actions may log a request body fragment in error
  // messages — keep that for debugging but sanitize if it surfaces real PII.
  sendDefaultPii: false,

  beforeSend(event) {
    // Attach the request-ID tag per-event rather than on the global hub.
    // The proxy sets x-request-id on every request; Sentry's automatic request
    // data integration captures it. This avoids hub mutation that would bleed
    // across concurrent requests on the same Node process.
    const requestId = event.request?.headers?.['x-request-id']
    if (requestId) {
      event.tags = { ...event.tags, requestId }
    }
    return event
  },
})
