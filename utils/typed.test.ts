import { describe, expect, it } from 'vitest'
import { typedObjectEntries, typedObjectKeys, typedObjectValues } from './typed'

describe('typedObjectEntries', () => {
  it('is the Object.entries function', () => {
    expect(typedObjectEntries).toBe(Object.entries)
  })

  it('returns the same entries as Object.entries', () => {
    const obj = { a: 1, b: 2 }
    expect(typedObjectEntries(obj)).toEqual(Object.entries(obj))
  })

  it('returns [] for an empty object', () => {
    expect(typedObjectEntries({})).toEqual([])
  })
})

describe('typedObjectKeys', () => {
  it('is the Object.keys function', () => {
    expect(typedObjectKeys).toBe(Object.keys)
  })

  it('returns the same keys as Object.keys', () => {
    const obj = { x: 'foo', y: 'bar' }
    expect(typedObjectKeys(obj)).toEqual(['x', 'y'])
  })

  it('returns [] for an empty object', () => {
    expect(typedObjectKeys({})).toEqual([])
  })
})

describe('typedObjectValues', () => {
  it('is the Object.values function', () => {
    expect(typedObjectValues).toBe(Object.values)
  })

  it('returns the same values as Object.values', () => {
    const obj = { a: 'one', b: 'two' }
    expect(typedObjectValues(obj)).toEqual(['one', 'two'])
  })

  it('returns [] for an empty object', () => {
    expect(typedObjectValues({})).toEqual([])
  })
})
