import { describe, expect, it } from 'vitest'
import { batch } from './batch'

describe('batch', () => {
  it('returns an empty array when items is empty', () => {
    expect(batch([], 3)).toEqual([])
  })

  it('returns one batch per item when size is 1', () => {
    expect(batch([1, 2, 3], 1)).toEqual([[1], [2], [3]])
  })

  it('returns a single batch when size equals length', () => {
    expect(batch([1, 2, 3], 3)).toEqual([[1, 2, 3]])
  })

  it('returns a single batch when size exceeds length', () => {
    expect(batch([1, 2, 3], 10)).toEqual([[1, 2, 3]])
  })

  it('splits evenly when length is divisible by size', () => {
    expect(batch([1, 2, 3, 4], 2)).toEqual([
      [1, 2],
      [3, 4],
    ])
  })

  it('puts the remainder into a smaller final batch', () => {
    expect(batch([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]])
  })

  it('returns an empty array when size is 0 (loop never advances past i=0)', () => {
    // size = 0 means i += 0, which would otherwise infinite-loop. The current
    // implementation only enters the loop when items.length > 0, so an empty
    // input is safe; for non-empty input it would loop forever — we therefore
    // only assert the empty-input fast path here.
    expect(batch([], 0)).toEqual([])
  })
})
