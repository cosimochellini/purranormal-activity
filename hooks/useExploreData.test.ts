/** @vitest-environment happy-dom */
import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// We must mock `nuqs` BEFORE the hook is imported.
// `vi.mock` is hoisted, so the factory must be self-contained.

const queryStateRef: { state: Record<string, unknown> } = { state: {} }

vi.mock('nuqs', () => {
  const makeParser = (defaultValue: unknown = null): Record<string, unknown> => ({
    defaultValue,
    withDefault(this: { defaultValue: unknown }, dv: unknown) {
      return makeParser(dv)
    },
    withOptions(this: { defaultValue: unknown }) {
      return makeParser(this.defaultValue)
    },
  })
  // Reach into the host module to share state between mock + tests.
  const host = globalThis as unknown as { __nuqsTestState?: Record<string, unknown> }
  if (!host.__nuqsTestState) host.__nuqsTestState = {}
  const sharedState: Record<string, unknown> = host.__nuqsTestState

  return {
    parseAsString: makeParser(),
    parseAsInteger: makeParser(),
    parseAsArrayOf: (_inner: unknown) => makeParser(),
    parseAsStringEnum: (_values: unknown) => makeParser(),
    useQueryState: vi.fn((key: string, parser: { defaultValue: unknown }) => {
      const setter = vi.fn((next: unknown) => {
        sharedState[key] = next
      })
      const current = key in sharedState ? sharedState[key] : parser?.defaultValue
      return [current, setter]
    }),
  }
})

const __nuqsHost = globalThis as unknown as { __nuqsTestState?: Record<string, unknown> }
if (!__nuqsHost.__nuqsTestState) __nuqsHost.__nuqsTestState = {}
queryStateRef.state = __nuqsHost.__nuqsTestState

import { SortBy, TimeRange } from '../types/search'
import { useExploreData } from './useExploreData'

beforeEach(() => {
  for (const k of Object.keys(queryStateRef.state)) delete queryStateRef.state[k]
})

describe('useExploreData', () => {
  it('returns the expected tuple shape with default values', () => {
    const { result } = renderHook(() => useExploreData())
    const [filters, setters] = result.current

    expect(filters).toMatchObject({
      page: 1,
      limit: 10,
      search: '',
      categories: [],
      sortBy: SortBy.Recent,
      timeRange: TimeRange.All,
    })

    expect(typeof setters.setPage).toBe('function')
    expect(typeof setters.setLimit).toBe('function')
    expect(typeof setters.setSearch).toBe('function')
    expect(typeof setters.setCategories).toBe('function')
    expect(typeof setters.setSortBy).toBe('function')
    expect(typeof setters.setTimeRange).toBe('function')
  })

  it('exposes setters that are reachable and callable', () => {
    const { result } = renderHook(() => useExploreData())
    const [, setters] = result.current

    act(() => {
      setters.setPage(3)
      setters.setSearch('ghost')
      setters.setCategories([1, 2])
      setters.setSortBy(SortBy.Title)
      setters.setTimeRange(TimeRange.Week)
    })

    expect(queryStateRef.state.page).toBe(3)
    expect(queryStateRef.state.search).toBe('ghost')
    expect(queryStateRef.state.categories).toEqual([1, 2])
    expect(queryStateRef.state.sortBy).toBe(SortBy.Title)
    expect(queryStateRef.state.timeRange).toBe(TimeRange.Week)
  })
})
