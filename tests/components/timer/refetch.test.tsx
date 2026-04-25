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

  it('calls router.invalidate() instead of reload, on each interval tick', () => {
    render(<Refetch interval={500} shouldRefetch />)

    vi.advanceTimersByTime(500)
    expect(invalidateMock).toHaveBeenCalledTimes(1)

    vi.advanceTimersByTime(500)
    expect(invalidateMock).toHaveBeenCalledTimes(2)
  })

  it('does not call invalidate when shouldRefetch=false', () => {
    render(<Refetch interval={500} shouldRefetch={false} />)
    vi.advanceTimersByTime(2_000)
    expect(invalidateMock).not.toHaveBeenCalled()
  })

  it('cleans up the interval on unmount', () => {
    const { unmount } = render(<Refetch interval={500} shouldRefetch />)
    vi.advanceTimersByTime(500)
    expect(invalidateMock).toHaveBeenCalledTimes(1)

    unmount()
    vi.advanceTimersByTime(2_000)
    // No more calls after unmount
    expect(invalidateMock).toHaveBeenCalledTimes(1)
  })
})
