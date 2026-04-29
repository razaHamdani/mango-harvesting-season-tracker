import type { NextConfig } from 'next'
import { withSentryConfig } from '@sentry/nextjs'

// Security headers are set dynamically per-request in src/proxy.ts so that
// a fresh nonce can be embedded in Content-Security-Policy on every response.
const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // CSRF defence: Next.js compares Server Action request Origin against the
      // host by default. If a reverse proxy rewrites Host/Origin in production,
      // this explicit allowlist is the source of truth.
      // Set NEXT_PUBLIC_PROD_DOMAIN in prod to your deployed domain
      // (e.g. "aamdaata.example.com"); leave unset in dev (default same-origin
      // check still applies).
      allowedOrigins: [
        // Always allow local dev. In production, also allow the deployed domain.
        'localhost:3000',
        ...(process.env.NEXT_PUBLIC_PROD_DOMAIN
          ? [process.env.NEXT_PUBLIC_PROD_DOMAIN]
          : []),
      ],
    },
  },
}

// Sentry config wrapper. When SENTRY_DSN is unset (local dev), the SDK is a
// no-op. When SENTRY_AUTH_TOKEN is unset, sourcemap upload is skipped — so
// the build still works without Sentry credentials.
export default withSentryConfig(nextConfig, {
  silent: !process.env.SENTRY_AUTH_TOKEN,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  sourcemaps: {
    disable: !process.env.SENTRY_AUTH_TOKEN,
  },
})
