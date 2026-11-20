import { describe, expect, it } from 'vitest'
import { assertLocalTargetSync } from './helpers/target-guard'

const API = 'http://127.0.0.1:54321'
const DB = 'postgresql://postgres:s3cretPw@127.0.0.1:54322/postgres'

function env(over: Record<string, string | undefined>) {
  return { NEXT_PUBLIC_SUPABASE_URL: API, SUPABASE_DB_URL: DB, ...over }
}

function rejects(over: Record<string, string | undefined>): Error {
  try {
    assertLocalTargetSync(env(over))
  } catch (e) {
    return e as Error
  }
  throw new Error('expected the guard to reject')
}

describe('test target guard', () => {
  it('accepts the local stack', () => {
    expect(() => assertLocalTargetSync(env({}))).not.toThrow()
    expect(() =>
      assertLocalTargetSync(
        env({
          NEXT_PUBLIC_SUPABASE_URL: 'http://localhost:54321',
          SUPABASE_DB_URL: 'postgres://postgres:pw@[::1]:54322/postgres',
        })
      )
    ).not.toThrow()
  })

  it.each([
    ['missing API URL', { NEXT_PUBLIC_SUPABASE_URL: undefined }],
    ['missing DB URL', { SUPABASE_DB_URL: undefined }],
    ['malformed DB URL', { SUPABASE_DB_URL: 'not a url' }],
    ['https API', { NEXT_PUBLIC_SUPABASE_URL: 'https://127.0.0.1:54321' }],
    ['remote API', { NEXT_PUBLIC_SUPABASE_URL: 'http://abc.supabase.co:54321' }],
    ['localhost as subdomain', { SUPABASE_DB_URL: 'postgresql://postgres:s3cretPw@localhost.evil.com:54322/postgres' }],
    ['loopback as subdomain', { SUPABASE_DB_URL: 'postgresql://postgres:s3cretPw@127.0.0.1.nip.io:54322/postgres' }],
    ['localhost in path', { SUPABASE_DB_URL: 'postgresql://postgres:s3cretPw@evil.com:54322/localhost' }],
    ['localhost in userinfo', { SUPABASE_DB_URL: 'postgresql://user:pw@localhost@evil.com:54322/postgres' }],
    ['wrong DB port', { SUPABASE_DB_URL: 'postgresql://postgres:s3cretPw@127.0.0.1:5432/postgres' }],
    ['wrong API port', { NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:8000' }],
    ['wrong database', { SUPABASE_DB_URL: 'postgresql://postgres:s3cretPw@127.0.0.1:54322/prod' }],
    ['host query override', { SUPABASE_DB_URL: `${DB}?host=evil.com` }],
    ['hostaddr query override', { SUPABASE_DB_URL: `${DB}?sslmode=disable&HostAddr=10.0.0.1` }],
    ['wrong DB scheme', { SUPABASE_DB_URL: 'mysql://postgres:s3cretPw@127.0.0.1:54322/postgres' }],
  ])('rejects %s', (_label, over) => {
    const err = rejects(over)
    expect(err.message).toMatch(/^Test guard:/)
  })

  it('never puts the URL or password in the error', () => {
    const bad = 'postgresql://postgres:TopSecret123@db.prod.example.com:5432/postgres'
    const err = rejects({ SUPABASE_DB_URL: bad })
    expect(err.message).not.toContain('TopSecret123')
    expect(err.message).not.toContain('db.prod.example.com')
    expect(err.message).not.toContain(bad)
  })
})
