/**
 * Verifies that attachRequestContext() reads x-request-id from next/headers and
 * sets it on the per-async-context Sentry scope.
 *
 * Why this test matters: 7D's beforeSend hook reads event.request.headers — but
 * Next.js middleware-injected headers don't reliably propagate to that capture
 * for Server Action errors. attachRequestContext is the actual mechanism that
 * gets the tag onto Sentry events. If this test breaks, 6B's request-correlation
 * goal silently breaks.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const setTagMock = vi.fn()
const headersGet = vi.fn()

vi.mock('next/headers', () => ({
  headers: vi.fn(async () => ({ get: headersGet })),
}))

vi.mock('@sentry/nextjs', () => ({
  getCurrentScope: () => ({ setTag: setTagMock }),
}))

import { attachRequestContext } from '@/lib/utils/request-context'

beforeEach(() => {
  setTagMock.mockClear()
  headersGet.mockReset()
})

describe('attachRequestContext', () => {
  it('sets the requestId tag when x-request-id header is present', async () => {
    headersGet.mockImplementation((name: string) =>
      name === 'x-request-id' ? 'abc12345' : null
    )

    await attachRequestContext()

    expect(setTagMock).toHaveBeenCalledOnce()
    expect(setTagMock).toHaveBeenCalledWith('requestId', 'abc12345')
  })

  it('does not call setTag when header is missing', async () => {
    headersGet.mockReturnValue(null)
    await attachRequestContext()
    expect(setTagMock).not.toHaveBeenCalled()
  })

  it('silently no-ops when headers() throws (e.g. outside request scope)', async () => {
    const { headers } = await import('next/headers')
    vi.mocked(headers).mockImplementationOnce(async () => {
      throw new Error('headers() called outside request scope')
    })

    await expect(attachRequestContext()).resolves.toBeUndefined()
    expect(setTagMock).not.toHaveBeenCalled()
  })
})
