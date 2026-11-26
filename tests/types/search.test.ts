import { describe, expect, it } from 'vitest'
import {
  EXPLORE_DEFAULTS,
  exploreSearchSchema,
  SEARCH_MAX_LENGTH,
  SortBy,
  TimeRange,
} from '@/types/search'

const parse = (input: unknown) => exploreSearchSchema.parse(input)

describe('exploreSearchSchema', () => {
  it('fills every default for an empty search', () => {
    expect(parse({})).toEqual(EXPLORE_DEFAULTS)
  })

  it('keeps valid values', () => {
    expect(
      parse({
        page: 2,
        limit: 20,
        search: 'ghost',
        categories: [1, 2],
        sortBy: SortBy.Title,
        timeRange: TimeRange.Week,
      }),
    ).toEqual({
      page: 2,
      limit: 20,
      search: 'ghost',
      categories: [1, 2],
      sortBy: SortBy.Title,
      timeRange: TimeRange.Week,
    })
  })

  it('accepts the legacy comma form and a single number for categories', () => {
    expect(parse({ categories: '1,2' }).categories).toEqual([1, 2])
    expect(parse({ categories: 3 }).categories).toEqual([3])
  })

  it('turns a JSON-parsed numeric search back into text', () => {
    expect(parse({ search: 123 }).search).toBe('123')
  })

  it('falls back per field instead of failing the whole URL', () => {
    expect(
      parse({
        page: 0,
        limit: 500,
        search: 'x'.repeat(SEARCH_MAX_LENGTH + 1),
        categories: ['a', -1],
        sortBy: 'nope',
        timeRange: 'forever',
      }),
    ).toEqual(EXPLORE_DEFAULTS)
  })
})
