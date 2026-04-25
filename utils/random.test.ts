import { afterEach, describe, expect, it, vi } from 'vitest'
import { randomItem } from './random'

describe('randomItem', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns the first item when Math.random returns 0', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
    expect(randomItem(['a', 'b', 'c'])).toBe('a')
  })

  it('returns the last item when Math.random returns ~0.999', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.999)
    expect(randomItem(['a', 'b', 'c'])).toBe('c')
  })

  it('returns the middle item for the appropriate Math.random slot', () => {
    // floor(0.5 * 3) === 1
    vi.spyOn(Math, 'random').mockReturnValue(0.5)
    expect(randomItem(['a', 'b', 'c'])).toBe('b')
  })

  it('works with single-element arrays', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.999)
    expect(randomItem(['only'])).toBe('only')
  })

  it('works with readonly tuples', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
    const tuple = ['x', 'y'] as const
    expect(randomItem(tuple)).toBe('x')
  })
})
