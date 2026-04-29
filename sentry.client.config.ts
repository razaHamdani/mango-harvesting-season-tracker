import * as Sentry from '@sentry/nextjs'

// Client-side Sentry init. Captures unhandled exceptions and promise
// rejections in the browser.
//
// NEXT_PUBLIC_SENTRY_DSN is exposed to the client bundle by design — Sentry
// DSNs are intended to be public (they only allow event submission, not read).
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN),
  tracesSampleRate: 0.1,

  // Replay sampling — capture session video on errors only to keep quota down.
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0.1,
})
