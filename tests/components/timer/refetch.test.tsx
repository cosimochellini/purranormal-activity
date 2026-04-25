/** @vitest-environment happy-dom */
import { cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { invalidateMock } = vi.hoisted(() => ({ invalidateMock: vi.fn() }))

vi.mock('@tanstack/react-router', () => ({
  useRouter: () => ({ invalidate: invalidateMock }),
  useNavigate: () => vi.fn(),
}))

import { Refetch } from '@/components/timer/refetch'

beforeEach(() => {
  vi.useFakeTimers()
  invalidateMock.mockReset().mockResolvedValue(undefined)
})

afterEach(() => {
  vi.useRealTimers()
  cleanup()
})

describe('Refetch — Bug #11 regression', () => {
  it('does NOT invoke window.location.reload when interval elapses', () => {
    const reloadSpy = vi.fn()
    // Stub the reload property; happy-dom may freeze location, so use defineProperty.
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...window.location, reload: reloadSpy },
    })

    render(<Refetch interval={500} shouldRefetch />)

    vi.advanceTimersByTime(2_000)

    expect(reloadSpy).not.toHaveBeenCalled()
  })

  it('calls router.invalidate() exactly once after the interval (no infinite loop)', () => {
    render(<Refetch interval={500} shouldRefetch />)

    vi.advanceTimersByTime(500)
    expect(invalidateMock).toHaveBeenCalledTimes(1)

    // Critical regression guard: the legacy implementation used setInterval,
    // which combined with the no-op SPA invalidation produced a perpetual
    // loop. The fix uses setTimeout, so further ticks must NOT fire.
    vi.advanceTimersByTime(5_000)
    expect(invalidateMock).toHaveBeenCalledTimes(1)
  })

  it('does not call invalidate when shouldRefetch=false', () => {
    render(<Refetch interval={500} shouldRefetch={false} />)
    vi.advanceTimersByTime(2_000)
    expect(invalidateMock).not.toHaveBeenCalled()
  })

  it('cleans up the timeout on unmount', () => {
    const { unmount } = render(<Refetch interval={500} shouldRefetch />)

    unmount()
    vi.advanceTimersByTime(2_000)
    expect(invalidateMock).not.toHaveBeenCalled()
  })
})
