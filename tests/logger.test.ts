/**
 * Verifies logError prefixes every log line with the request ID from
 * next/headers — the mechanism that makes Server Action logs correlatable
 * with the proxy log line and the x-request-id response header.
 *
 * captureConsoleIntegration (sentry.server.config.ts) promotes these
 * console.error lines to Sentry events, so the prefix is also what ties a
 * Sentry event back to a specific request.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const headersGet = vi.fn()

vi.mock('next/headers', () => ({
  headers: vi.fn(async () => ({ get: headersGet })),
}))

import { logError } from '@/lib/utils/logger'

beforeEach(() => {
  headersGet.mockReset()
})

describe('logError', () => {
  it('prefixes the log line with scope and request id', async () => {
    headersGet.mockImplementation((name: string) =>
      name === 'x-request-id' ? 'abc12345' : null
    )
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const err = new Error('boom')
    await logError('createExpense.insert', err)

    expect(spy).toHaveBeenCalledOnce()
    expect(spy).toHaveBeenCalledWith('[createExpense.insert] req=abc12345', err)
    spy.mockRestore()
  })

  it('falls back to "?" when the header is missing', async () => {
    headersGet.mockReturnValue(null)
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})

    await logError('scope', 'oops')

    expect(spy).toHaveBeenCalledWith('[scope] req=?', 'oops')
    spy.mockRestore()
  })

  it('still logs when headers() throws (outside request scope)', async () => {
    const { headers } = await import('next/headers')
    vi.mocked(headers).mockImplementationOnce(async () => {
      throw new Error('headers() called outside request scope')
    })
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})

    await logError('scope', 'oops')

    expect(spy).toHaveBeenCalledWith('[scope] req=?', 'oops')
    spy.mockRestore()
  })
})
