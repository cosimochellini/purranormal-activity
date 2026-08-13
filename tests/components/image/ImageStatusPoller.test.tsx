/** @vitest-environment happy-dom */
import { cleanup, render } from '@testing-library/react'
import { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { invalidate } = vi.hoisted(() => ({ invalidate: vi.fn(async () => undefined) }))

// `useRouter` rather than the module-level `getActiveRouter` from
// `@/start/router`: importing that would drag `routeTree.gen.ts` — and with it
// every API route and `r2.server.ts` — into this component test.
vi.mock('@tanstack/react-router', () => ({
  useRouter: () => ({ invalidate }),
}))

import { ImageStatusPoller } from '@/components/image/ImageStatusPoller'
import { UI_CONFIG } from '@/constants'
import { logger } from '@/utils/logger'

const log = {
  id: 7,
  title: 't',
  description: 'd',
  imageDescription: '',
  status: 'Created',
  error: null,
  attempts: 0,
  createdAt: 0,
  updatedAt: 0,
  categories: [],
}

// The poller chains `setTimeout` around an async `invalidate`, so each tick
// needs both the timer advanced and the microtask queue flushed.
const tick = async (ms: number) => {
  await act(async () => {
    vi.advanceTimersByTime(ms)
    await Promise.resolve()
    await Promise.resolve()
  })
}

const fastTick = () => tick(UI_CONFIG.POLL_INTERVAL_MS)

beforeEach(() => {
  vi.useFakeTimers()
  invalidate.mockReset()
  invalidate.mockResolvedValue(undefined)
  vi.mocked(logger.error).mockReset()
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('ImageStatusPoller', () => {
  it('renders nothing', () => {
    const { container } = render(<ImageStatusPoller log={log as never} />)
    expect(container.firstChild).toBeNull()
  })

  it('does not poll a log that already has its image', async () => {
    render(<ImageStatusPoller log={{ ...log, status: 'ImageGenerated' } as never} />)

    await fastTick()

    expect(invalidate).not.toHaveBeenCalled()
  })

  it('does not poll a failed log', async () => {
    render(<ImageStatusPoller log={{ ...log, status: 'Error' } as never} />)

    await fastTick()

    expect(invalidate).not.toHaveBeenCalled()
  })

  it('invalidates only the matching log route', async () => {
    render(<ImageStatusPoller log={log as never} />)

    await fastTick()

    expect(invalidate).toHaveBeenCalledOnce()
    const { filter } = invalidate.mock.calls[0][0] as {
      filter: (match: { routeId: string; params: Record<string, string> }) => boolean
    }
    expect(filter({ routeId: '/$id/', params: { id: '7' } })).toBe(true)
    expect(filter({ routeId: '/$id/', params: { id: '8' } })).toBe(false)
    expect(filter({ routeId: '/explore', params: {} })).toBe(false)
  })

  it('keeps polling while the log stays pending', async () => {
    render(<ImageStatusPoller log={log as never} />)

    await fastTick()
    await fastTick()
    await fastTick()

    expect(invalidate).toHaveBeenCalledTimes(3)
  })

  it('backs off after the fast tier instead of hammering the loader', async () => {
    render(<ImageStatusPoller log={log as never} />)

    for (let i = 0; i < UI_CONFIG.POLL_FAST_ATTEMPTS; i++) await fastTick()
    expect(invalidate).toHaveBeenCalledTimes(UI_CONFIG.POLL_FAST_ATTEMPTS)

    // The next poll is scheduled at 2× the base interval, so one base interval
    // is not enough to fire it.
    await fastTick()
    expect(invalidate).toHaveBeenCalledTimes(UI_CONFIG.POLL_FAST_ATTEMPTS)

    await fastTick()
    expect(invalidate).toHaveBeenCalledTimes(UI_CONFIG.POLL_FAST_ATTEMPTS + 1)
  })

  it('stops at the attempt cap', async () => {
    render(<ImageStatusPoller log={log as never} />)

    // Well past the whole schedule.
    for (let i = 0; i < UI_CONFIG.POLL_MAX_ATTEMPTS * 6; i++) await fastTick()

    expect(invalidate).toHaveBeenCalledTimes(UI_CONFIG.POLL_MAX_ATTEMPTS)
  })

  it('does not reset the attempt budget when the loader returns a fresh object', async () => {
    // Regression guard: `router.invalidate` re-runs the loader, which returns a
    // NEW `log` object every time. An effect that depended on `log` would tear
    // the timer down, rebuild it, and reset the counter — polling forever.
    const { rerender } = render(<ImageStatusPoller log={log as never} />)

    for (let i = 0; i < 5; i++) {
      await fastTick()
      rerender(<ImageStatusPoller log={{ ...log } as never} />)
    }

    for (let i = 0; i < UI_CONFIG.POLL_MAX_ATTEMPTS * 6; i++) await fastTick()

    expect(invalidate).toHaveBeenCalledTimes(UI_CONFIG.POLL_MAX_ATTEMPTS)
  })

  it('stops as soon as the status changes', async () => {
    const { rerender } = render(<ImageStatusPoller log={log as never} />)

    await fastTick()
    expect(invalidate).toHaveBeenCalledTimes(1)

    rerender(<ImageStatusPoller log={{ ...log, status: 'ImageGenerated' } as never} />)
    await fastTick()
    await fastTick()

    expect(invalidate).toHaveBeenCalledTimes(1)
  })

  it('restarts with a full budget when a retry puts the row back to pending', async () => {
    const { rerender } = render(<ImageStatusPoller log={{ ...log, status: 'Error' } as never} />)
    await fastTick()
    expect(invalidate).not.toHaveBeenCalled()

    rerender(<ImageStatusPoller log={{ ...log, status: 'Created' } as never} />)
    await fastTick()

    expect(invalidate).toHaveBeenCalledTimes(1)
  })

  it('clears the timer on unmount', async () => {
    const { unmount } = render(<ImageStatusPoller log={log as never} />)

    unmount()
    await fastTick()
    await fastTick()

    expect(invalidate).not.toHaveBeenCalled()
  })

  it('logs a rejected invalidation and keeps polling', async () => {
    invalidate.mockRejectedValueOnce(new Error('loader exploded'))
    render(<ImageStatusPoller log={log as never} />)

    await fastTick()
    expect(vi.mocked(logger.error)).toHaveBeenCalled()

    await fastTick()
    expect(invalidate).toHaveBeenCalledTimes(2)
  })
})
