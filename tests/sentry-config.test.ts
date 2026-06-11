/**
 * Smoke test: both server and edge Sentry configs register
 * captureConsoleIntegration for the 'error' level.
 *
 * Why this matters: Server Actions catch their errors and return { error } to
 * the client — nothing ever throws past the action, so console.error (via
 * logError) is the ONLY signal that reaches Sentry. The default console
 * integration records breadcrumbs, not events; without captureConsoleIntegration
 * production failures are invisible.
 */
import { describe, it, expect, vi } from 'vitest'

const initMock = vi.fn()
const captureConsoleMock = vi.fn((opts) => ({ name: 'CaptureConsole', opts }))

vi.mock('@sentry/nextjs', () => ({
  init: initMock,
  captureConsoleIntegration: captureConsoleMock,
}))

describe('sentry config', () => {
  it('server config registers captureConsoleIntegration for error level', async () => {
    await import('../sentry.server.config')

    expect(captureConsoleMock).toHaveBeenCalledWith({ levels: ['error'] })
    const initArg = initMock.mock.calls.at(-1)![0]
    expect(initArg.integrations).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: 'CaptureConsole' })])
    )
  })

  it('edge config registers captureConsoleIntegration for error level', async () => {
    initMock.mockClear()
    captureConsoleMock.mockClear()

    await import('../sentry.edge.config')

    expect(captureConsoleMock).toHaveBeenCalledWith({ levels: ['error'] })
    const initArg = initMock.mock.calls.at(-1)![0]
    expect(initArg.integrations).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: 'CaptureConsole' })])
    )
  })
})
