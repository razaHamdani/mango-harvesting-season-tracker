import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'
import { resolve, dirname } from 'node:path'
import { config as loadEnv } from 'dotenv'

const here = dirname(fileURLToPath(import.meta.url))

// Load .env.test BEFORE the config object is built, so the values are
// visible when Next.js / our server code reads process.env at import time.
loadEnv({ path: resolve(here, '.env.test') })

export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    include: ['tests/**/*.test.ts'],
    setupFiles: ['tests/setup.ts'],
    testTimeout: 20_000,
    hookTimeout: 30_000,
    // Tests mutate shared DB state; run them serially for determinism.
    // Concurrency inside a single test (e.g. Promise.all) is still allowed
    // and is exactly what the TOCTOU test depends on.
    pool: 'forks',
    fileParallelism: false,
  },
  resolve: {
    alias: {
      '@': resolve(here, 'src'),
    },
  },
})
