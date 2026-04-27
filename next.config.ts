import type { NextConfig } from 'next'

// Security headers are set dynamically per-request in src/proxy.ts so that
// a fresh nonce can be embedded in Content-Security-Policy on every response.
const nextConfig: NextConfig = {}

export default nextConfig
