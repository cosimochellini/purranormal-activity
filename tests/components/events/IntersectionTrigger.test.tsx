/** @vitest-environment happy-dom */
import { cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { inViewState } = vi.hoisted(() => ({
  inViewState: { value: false },
}))

vi.mock('react-intersection-observer', () => ({
  useInView: () => ({
    ref: () => {},
    inView: inViewState.value,
  }),
}))

import { IntersectionTrigger } from '@/components/events/IntersectionTrigger'

beforeEach(() => {
  inViewState.value = false
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('IntersectionTrigger', () => {
  it('does not call onIntersect while not in view', () => {
    const onIntersect = vi.fn()
    render(<IntersectionTrigger onIntersect={onIntersect} />)
    expect(onIntersect).not.toHaveBeenCalled()
  })

  it('calls onIntersect when becoming in view', () => {
    const onIntersect = vi.fn()
    inViewState.value = true
    render(<IntersectionTrigger onIntersect={onIntersect} />)
    expect(onIntersect).toHaveBeenCalledTimes(1)
  })

  it('does not call onIntersect when disabled, even if in view', () => {
    const onIntersect = vi.fn()
    inViewState.value = true
    render(<IntersectionTrigger onIntersect={onIntersect} disabled />)
    expect(onIntersect).not.toHaveBeenCalled()
  })

  it('debounces rapid retriggers (does not double-fire within 500ms)', () => {
    // Stub Date.now so we can advance "wall clock" time the debounce uses.
    let now = 1_000_000
    const dateSpy = vi.spyOn(Date, 'now').mockImplementation(() => now)

    const onIntersect = vi.fn()
    inViewState.value = true
    const { rerender } = render(<IntersectionTrigger onIntersect={onIntersect} />)
    expect(onIntersect).toHaveBeenCalledTimes(1)

    // Re-render within the debounce window with a NEW handler identity to
    // force an effect re-run.
    const onIntersect2 = vi.fn()
    now += 100
    rerender(<IntersectionTrigger onIntersect={onIntersect2} />)
    expect(onIntersect2).not.toHaveBeenCalled()

    // Past the debounce window
    now += 600
    const onIntersect3 = vi.fn()
    rerender(<IntersectionTrigger onIntersect={onIntersect3} />)
    expect(onIntersect3).toHaveBeenCalledTimes(1)

    dateSpy.mockRestore()
  })
})
