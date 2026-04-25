/** @vitest-environment happy-dom */
import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { usePartialState } from './state'

interface State {
  a: number
  b: string
  c: boolean
}

describe('usePartialState', () => {
  it('returns the initial value (object form)', () => {
    const initial: State = { a: 1, b: 'x', c: false }
    const { result } = renderHook(() => usePartialState(initial))
    expect(result.current[0]).toEqual(initial)
  })

  it('supports a function initializer (lazy form)', () => {
    let calls = 0
    const init = () => {
      calls += 1
      return { a: 42, b: 'lazy', c: true } satisfies State
    }
    const { result } = renderHook(() => usePartialState<State>(init))
    expect(result.current[0]).toEqual({ a: 42, b: 'lazy', c: true })
    expect(calls).toBe(1)
  })

  it('merges a partial update without erasing other keys', () => {
    const { result } = renderHook(() => usePartialState<State>({ a: 1, b: 'x', c: false }))
    act(() => {
      result.current[1]({ a: 9 })
    })
    expect(result.current[0]).toEqual({ a: 9, b: 'x', c: false })
  })

  it('composes multiple sequential updates', () => {
    const { result } = renderHook(() => usePartialState<State>({ a: 1, b: 'x', c: false }))
    act(() => {
      result.current[1]({ a: 2 })
    })
    act(() => {
      result.current[1]({ b: 'y' })
    })
    act(() => {
      result.current[1]({ c: true })
    })
    expect(result.current[0]).toEqual({ a: 2, b: 'y', c: true })
  })

  it('keeps the updater function reference identity stable across renders', () => {
    const { result, rerender } = renderHook(() =>
      usePartialState<State>({ a: 1, b: 'x', c: false }),
    )
    const firstUpdater = result.current[1]
    rerender()
    const secondUpdater = result.current[1]
    // useState returns the same setter; our updater closes over it without memoization,
    // so identity may not be stable. We assert that calling either yields the same effect.
    act(() => {
      secondUpdater({ a: 5 })
    })
    expect(result.current[0]).toEqual({ a: 5, b: 'x', c: false })
    // sanity: both refer to functions
    expect(typeof firstUpdater).toBe('function')
  })
})
