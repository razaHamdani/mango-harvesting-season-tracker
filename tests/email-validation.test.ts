/**
 * Unit tests for email-validation utilities.
 *
 * hasMxRecords real-DNS cases hit the network — they run against the
 * host's resolver, so they need an internet connection. The network-error
 * path is exercised via a vi.spyOn mock so CI doesn't need special DNS setup.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import * as dns from 'dns'
import { EMAIL_RE, hasMxRecords } from '@/lib/utils/email-validation'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('EMAIL_RE', () => {
  it('accepts a well-formed address', () => {
    expect(EMAIL_RE.test('user@gmail.com')).toBe(true)
  })

  it('rejects an address with no @', () => {
    expect(EMAIL_RE.test('notanemail')).toBe(false)
  })

  it('rejects an empty string', () => {
    expect(EMAIL_RE.test('')).toBe(false)
  })

  it('rejects whitespace inside the address', () => {
    expect(EMAIL_RE.test('user @gmail.com')).toBe(false)
  })

  it('rejects an address with no domain part after @', () => {
    expect(EMAIL_RE.test('user@')).toBe(false)
  })
})

describe('hasMxRecords — real DNS', () => {
  it('returns true for gmail.com (has MX records)', async () => {
    expect(await hasMxRecords('gmail.com')).toBe(true)
  }, 10_000)

  it('returns false for a nonexistent domain', async () => {
    expect(await hasMxRecords('this-domain-absolutely-does-not-exist-xyz99999.com')).toBe(false)
  }, 10_000)
})

describe('hasMxRecords — error handling', () => {
  it('returns true (fail-open) when DNS times out', async () => {
    vi.spyOn(dns.promises, 'resolveMx').mockRejectedValue(
      Object.assign(new Error('queryMx ETIMEOUT'), { code: 'ETIMEOUT' })
    )
    expect(await hasMxRecords('gmail.com')).toBe(true)
  })

  it('returns true (fail-open) when DNS server fails', async () => {
    vi.spyOn(dns.promises, 'resolveMx').mockRejectedValue(
      Object.assign(new Error('queryMx ESERVFAIL'), { code: 'ESERVFAIL' })
    )
    expect(await hasMxRecords('gmail.com')).toBe(true)
  })

  it('returns false when domain has no MX records (ENODATA)', async () => {
    vi.spyOn(dns.promises, 'resolveMx').mockRejectedValue(
      Object.assign(new Error('queryMx ENODATA'), { code: 'ENODATA' })
    )
    expect(await hasMxRecords('example.com')).toBe(false)
  })

  it('returns false when domain does not exist (ENOTFOUND)', async () => {
    vi.spyOn(dns.promises, 'resolveMx').mockRejectedValue(
      Object.assign(new Error('queryMx ENOTFOUND'), { code: 'ENOTFOUND' })
    )
    expect(await hasMxRecords('fakefakefake.xyz')).toBe(false)
  })

  it('returns false when resolveMx returns an empty array', async () => {
    vi.spyOn(dns.promises, 'resolveMx').mockResolvedValue([])
    expect(await hasMxRecords('empty-mx-domain.com')).toBe(false)
  })
})
