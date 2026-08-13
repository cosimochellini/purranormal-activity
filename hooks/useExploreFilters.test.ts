/** @vitest-environment happy-dom */
import { act, renderHook } from '@testing-library/react'
import { NuqsTestingAdapter, type UrlUpdateEvent } from 'nuqs/adapters/testing'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SortBy, TimeRange } from '../types/search'
import { useExploreFilters } from './useExploreFilters'

interface RenderOptions {
  searchParams?: string
  onUrlUpdate?: (event: UrlUpdateEvent) => void
  rateLimitFactor?: number
}

const renderUseExploreFilters = ({
  searchParams = '',
  onUrlUpdate,
  rateLimitFactor = 0,
}: RenderOptions = {}) =>
  renderHook(() => useExploreFilters(), {
    wrapper: ({ children }) =>
      NuqsTestingAdapter({
        searchParams,
        onUrlUpdate,
        rateLimitFactor,
        hasMemory: true,
        children,
      }),
  })

describe('useExploreFilters', () => {
  describe('default state', () => {
    it('returns all six fields at declared defaults', () => {
      const { result } = renderUseExploreFilters()

      expect(result.current.filters).toEqual({
        page: 1,
        limit: 10,
        search: '',
        categories: [],
        sortBy: SortBy.Recent,
        timeRange: TimeRange.All,
      })
    })

    it('exposes page === 1 by default', () => {
      const { result } = renderUseExploreFilters()
      expect(result.current.filters.page).toBe(1)
    })
  })

  describe('page-reset invariant', () => {
    it('resets page to 1 when search changes', async () => {
      const onUrlUpdate = vi.fn()
      const { result } = renderUseExploreFilters({ searchParams: '?page=5', onUrlUpdate })

      await act(async () => {
        await result.current.setFilters({ search: 'ghost' })
      })

      const last = onUrlUpdate.mock.calls.at(-1)?.[0] as UrlUpdateEvent | undefined
      expect(last?.searchParams.get('search')).toBe('ghost')
      expect(last?.searchParams.get('page')).toBeNull()
      // single URL write
      expect(onUrlUpdate).toHaveBeenCalledTimes(1)
    })

    it('resets page to 1 when categories change', async () => {
      const onUrlUpdate = vi.fn()
      const { result } = renderUseExploreFilters({ searchParams: '?page=5', onUrlUpdate })

      await act(async () => {
        await result.current.setFilters({ categories: [1, 2] })
      })

      const last = onUrlUpdate.mock.calls.at(-1)?.[0] as UrlUpdateEvent | undefined
      expect(last?.searchParams.get('categories')).toBe('1,2')
      expect(last?.searchParams.get('page')).toBeNull()
      expect(onUrlUpdate).toHaveBeenCalledTimes(1)
    })

    it('resets page to 1 when sortBy changes', async () => {
      const onUrlUpdate = vi.fn()
      const { result } = renderUseExploreFilters({ searchParams: '?page=5', onUrlUpdate })

      await act(async () => {
        await result.current.setFilters({ sortBy: SortBy.Oldest })
      })

      const last = onUrlUpdate.mock.calls.at(-1)?.[0] as UrlUpdateEvent | undefined
      expect(last?.searchParams.get('sortBy')).toBe(SortBy.Oldest)
      expect(last?.searchParams.get('page')).toBeNull()
      expect(onUrlUpdate).toHaveBeenCalledTimes(1)
    })

    it('resets page to 1 when timeRange changes', async () => {
      const onUrlUpdate = vi.fn()
      const { result } = renderUseExploreFilters({ searchParams: '?page=5', onUrlUpdate })

      await act(async () => {
        await result.current.setFilters({ timeRange: TimeRange.Week })
      })

      const last = onUrlUpdate.mock.calls.at(-1)?.[0] as UrlUpdateEvent | undefined
      expect(last?.searchParams.get('timeRange')).toBe(TimeRange.Week)
      expect(last?.searchParams.get('page')).toBeNull()
      expect(onUrlUpdate).toHaveBeenCalledTimes(1)
    })

    it('resets page to 1 when limit changes', async () => {
      const onUrlUpdate = vi.fn()
      const { result } = renderUseExploreFilters({ searchParams: '?page=5', onUrlUpdate })

      await act(async () => {
        await result.current.setFilters({ limit: 25 })
      })

      const last = onUrlUpdate.mock.calls.at(-1)?.[0] as UrlUpdateEvent | undefined
      expect(last?.searchParams.get('limit')).toBe('25')
      expect(last?.searchParams.get('page')).toBeNull()
      expect(onUrlUpdate).toHaveBeenCalledTimes(1)
    })

    it('honours explicit page when only page is in the partial', async () => {
      const onUrlUpdate = vi.fn()
      const { result } = renderUseExploreFilters({ onUrlUpdate })

      await act(async () => {
        await result.current.setFilters({ page: 5 })
      })

      const last = onUrlUpdate.mock.calls.at(-1)?.[0] as UrlUpdateEvent | undefined
      expect(last?.searchParams.get('page')).toBe('5')
      expect(onUrlUpdate).toHaveBeenCalledTimes(1)
    })

    it('honours explicit page when page is provided alongside other keys', async () => {
      const onUrlUpdate = vi.fn()
      const { result } = renderUseExploreFilters({ onUrlUpdate })

      await act(async () => {
        await result.current.setFilters({ search: 'ghost', page: 3 })
      })

      const last = onUrlUpdate.mock.calls.at(-1)?.[0] as UrlUpdateEvent | undefined
      expect(last?.searchParams.get('search')).toBe('ghost')
      expect(last?.searchParams.get('page')).toBe('3')
      expect(onUrlUpdate).toHaveBeenCalledTimes(1)
    })

    it('stale-page regression: page=5 then setFilters({ search: "x" }) lands at page=1, search="x"', async () => {
      const onUrlUpdate = vi.fn()
      const { result } = renderUseExploreFilters({ onUrlUpdate })

      await act(async () => {
        await result.current.setFilters({ page: 5 })
      })
      await act(async () => {
        await result.current.setFilters({ search: 'x' })
      })

      // The second write must clear `page` (back to default 1) and set search.
      const last = onUrlUpdate.mock.calls.at(-1)?.[0] as UrlUpdateEvent | undefined
      expect(last?.searchParams.get('search')).toBe('x')
      expect(last?.searchParams.get('page')).toBeNull()
      expect(result.current.filters.page).toBe(1)
      expect(result.current.filters.search).toBe('x')
    })
  })

  describe('reset', () => {
    it('returns all six fields to defaults in one URL write', async () => {
      const onUrlUpdate = vi.fn()
      const { result } = renderUseExploreFilters({
        searchParams: '?page=5&limit=25&search=ghost&categories=1,2&sortBy=oldest&timeRange=week',
        onUrlUpdate,
      })

      // sanity check the seeded state
      expect(result.current.filters).toEqual({
        page: 5,
        limit: 25,
        search: 'ghost',
        categories: [1, 2],
        sortBy: SortBy.Oldest,
        timeRange: TimeRange.Week,
      })

      await act(async () => {
        await result.current.reset()
      })

      expect(result.current.filters).toEqual({
        page: 1,
        limit: 10,
        search: '',
        categories: [],
        sortBy: SortBy.Recent,
        timeRange: TimeRange.All,
      })
      // single URL write
      expect(onUrlUpdate).toHaveBeenCalledTimes(1)
    })
  })

  describe('search throttle', () => {
    beforeEach(() => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance', 'Date'] })
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('throttles search URL writes at 1000ms', async () => {
      const onUrlUpdate = vi.fn()
      // rateLimitFactor: 1 makes the testing adapter honour real throttle delays.
      const { result } = renderUseExploreFilters({ onUrlUpdate, rateLimitFactor: 1 })

      act(() => {
        result.current.setFilters({ search: 'ab' })
      })

      // Within the 1000ms throttle window, no URL write has landed yet.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(500)
      })
      expect(onUrlUpdate).not.toHaveBeenCalled()

      // After the throttle window elapses, the queued write flushes.
      //
      // Advanced in bounded steps rather than one fixed 2000ms jump: nuqs keeps
      // `lastFlushedAt` on a module-level queue singleton and stamps it with
      // `performance.now()`, so the earlier real-timer tests in this file leave
      // a REAL timestamp there. Against this fake clock (which starts near zero)
      // that subtraction goes negative by however long the process has been
      // alive, which only ever *inflates* the scheduled delay — harmless for the
      // 500ms assertion above, but it made a fixed 2000ms advance too short on
      // CI, where the suite reaches this file later than it does locally.
      await act(async () => {
        for (let i = 0; i < 300 && onUrlUpdate.mock.calls.length === 0; i++) {
          await vi.advanceTimersByTimeAsync(1000)
        }
      })
      expect(onUrlUpdate).toHaveBeenCalledTimes(1)
      const last = onUrlUpdate.mock.calls.at(-1)?.[0] as UrlUpdateEvent | undefined
      expect(last?.searchParams.get('search')).toBe('ab')
    })
  })
})
