import * as Sentry from '@sentry/nextjs'

// Edge-runtime Sentry init (the proxy / middleware runs on edge).
// captureConsoleIntegration promotes console.error to events — without it the
// default console integration records breadcrumbs only.
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  enabled: Boolean(process.env.SENTRY_DSN),
  tracesSampleRate: 0.1,
  sendDefaultPii: false,

  integrations: [Sentry.captureConsoleIntegration({ levels: ['error'] })],

  beforeSend(event) {
    const requestId = event.request?.headers?.['x-request-id']
    if (requestId) {
      event.tags = { ...event.tags, requestId }
    }
    return event
  },
})
