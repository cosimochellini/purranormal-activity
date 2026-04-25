import { describe, expect, it } from 'vitest'
import { distinctBy, range } from './array'

describe('distinctBy', () => {
  it('keeps the last occurrence of each key', () => {
    // Map.set semantics: last write wins.
    const items = [
      { id: '1', name: 'a' },
      { id: '2', name: 'b' },
      { id: '1', name: 'a-dup' },
    ]
    expect(distinctBy(items, (i) => i.id)).toEqual([
      { id: '1', name: 'a-dup' },
      { id: '2', name: 'b' },
    ])
  })

  it('returns empty for empty input', () => {
    expect(distinctBy<{ id: string }>([], (x) => x.id)).toEqual([])
  })

  it('handles all-distinct input as identity', () => {
    expect(distinctBy([{ k: 'a' }, { k: 'b' }, { k: 'c' }], (x) => x.k)).toEqual([
      { k: 'a' },
      { k: 'b' },
      { k: 'c' },
    ])
  })
})

describe('range', () => {
  it('returns 0..n-1 for positive length', () => {
    expect(range(4)).toEqual([0, 1, 2, 3])
  })

  it('returns empty for zero', () => {
    expect(range(0)).toEqual([])
  })
})
