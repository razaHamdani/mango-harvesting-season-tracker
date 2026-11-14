import { afterEach, describe, expect, it, vi } from 'vitest'
import { GET } from '@/app/api/health/route'

// Runs against the local Supabase started in CI; .env.test (loaded by
// vitest.config.ts) provides NEXT_PUBLIC_SUPABASE_URL / ANON_KEY.
describe('GET /api/health', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('returns 200 {ok:true} when the seasons columns are queryable', async () => {
    const res = await GET()
    expect(res.status).toBe(200)
    expect(res.headers.get('Cache-Control')).toBe('no-store')
    expect(await res.json()).toEqual({ ok: true })
  })

  it('returns 503 {ok:false} when the database is unreachable', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'http://127.0.0.1:9')
    const res = await GET()
    expect(res.status).toBe(503)
    expect(res.headers.get('Cache-Control')).toBe('no-store')
    expect(await res.json()).toEqual({ ok: false })
  })
})
