import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { wait } from './promise'

describe('wait', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('resolves after the given number of milliseconds', async () => {
    const resolved = vi.fn()
    const promise = wait(1000).then(resolved)

    expect(resolved).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(999)
    expect(resolved).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(1)
    await promise
    expect(resolved).toHaveBeenCalledTimes(1)
  })

  it('resolves immediately on the next tick when ms is 0', async () => {
    const resolved = vi.fn()
    const promise = wait(0).then(resolved)
    await vi.advanceTimersByTimeAsync(0)
    await promise
    expect(resolved).toHaveBeenCalledTimes(1)
  })

  it('returns a Promise', () => {
    const p = wait(100)
    expect(p).toBeInstanceOf(Promise)
  })
})
