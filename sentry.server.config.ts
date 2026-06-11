import * as Sentry from '@sentry/nextjs'

// Server-side Sentry init. Captures uncaught errors in Server Components,
// Server Actions, route handlers, and the proxy. Server Actions catch their
// errors and return { error } to the client, so nothing throws — console.error
// is the only signal, and the default console integration records breadcrumbs
// only. captureConsoleIntegration promotes console.error lines to events.
//
// SENTRY_DSN is the only required env var in production. Leave it unset in
// local dev — Sentry SDK becomes a no-op.
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  enabled: Boolean(process.env.SENTRY_DSN),

  integrations: [Sentry.captureConsoleIntegration({ levels: ['error'] })],

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
