import * as Sentry from '@sentry/nextjs'

// Edge-runtime Sentry init (the proxy / middleware runs on edge).
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  enabled: Boolean(process.env.SENTRY_DSN),
  tracesSampleRate: 0.1,
  sendDefaultPii: false,

  beforeSend(event) {
    const requestId = event.request?.headers?.['x-request-id']
    if (requestId) {
      event.tags = { ...event.tags, requestId }
    }
    return event
  },
})
