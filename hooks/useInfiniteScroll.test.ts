/** @vitest-environment happy-dom */
import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Mock fetcher: returns a function whose return value is controlled per-test.
const { fetcherImpl } = vi.hoisted(() => ({ fetcherImpl: vi.fn() }))
vi.mock('@/utils/fetch', () => ({
  fetcher: () => fetcherImpl,
}))

import type { LogWithCategories } from '@/db/schema'
import { useInfiniteScroll } from './useInfiniteScroll'

const makeLog = (id: number): LogWithCategories =>
  ({
    id,
    title: `t${id}`,
    description: `d${id}`,
    createdAt: 0,
    updatedAt: 0,
    status: 'created',
    error: null,
    imageDescription: null,
    categories: [],
  }) as unknown as LogWithCategories

beforeEach(() => {
  fetcherImpl.mockReset()
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('useInfiniteScroll', () => {
  it('initial state derives nextPage and hasMore from initialLogs vs limit', () => {
    const initialLogs = [makeLog(1), makeLog(2), makeLog(3)]
    const { result } = renderHook(() => useInfiniteScroll({ initialLogs, initialLimit: 3 }))
    expect(result.current.logs).toHaveLength(3)
    expect(result.current.nextPage).toBe(2)
    expect(result.current.hasMore).toBe(true)
    expect(result.current.isLoading).toBe(false)
  })

  it('initial state when initialLogs is shorter than limit: nextPage null, hasMore false', () => {
    const { result } = renderHook(() =>
      useInfiniteScroll({ initialLogs: [makeLog(1)], initialLimit: 5 }),
    )
    expect(result.current.nextPage).toBeNull()
    expect(result.current.hasMore).toBe(false)
  })

  it('handleLoadMore appends new logs and dedupes existing ids', async () => {
    const initialLogs = [makeLog(1), makeLog(2), makeLog(3)]
    fetcherImpl.mockResolvedValueOnce({
      success: true,
      data: [makeLog(3), makeLog(4), makeLog(5)],
      hasMore: true,
      nextPage: 3,
    })
    const { result } = renderHook(() => useInfiniteScroll({ initialLogs, initialLimit: 3 }))

    act(() => {
      result.current.handleLoadMore()
    })

    await waitFor(() => {
      expect(result.current.logs).toHaveLength(5)
    })

    expect(result.current.logs.map((l) => l.id)).toEqual([1, 2, 3, 4, 5])
    expect(result.current.nextPage).toBe(3)
    expect(result.current.hasMore).toBe(true)
    expect(result.current.isLoading).toBe(false)
  })

  it('hasMore flips to false when API reports no more pages', async () => {
    const initialLogs = [makeLog(1), makeLog(2), makeLog(3)]
    fetcherImpl.mockResolvedValueOnce({
      success: true,
      data: [makeLog(4)],
      hasMore: false,
      nextPage: null,
    })
    const { result } = renderHook(() => useInfiniteScroll({ initialLogs, initialLimit: 3 }))

    act(() => {
      result.current.handleLoadMore()
    })

    await waitFor(() => {
      expect(result.current.hasMore).toBe(false)
    })

    expect(result.current.nextPage).toBeNull()
    expect(result.current.logs.map((l) => l.id)).toEqual([1, 2, 3, 4])
  })

  it('error path resets isLoading and keeps existing logs', async () => {
    const initialLogs = [makeLog(1), makeLog(2), makeLog(3)]
    fetcherImpl.mockRejectedValueOnce(new Error('boom'))
    const { result } = renderHook(() => useInfiniteScroll({ initialLogs, initialLimit: 3 }))

    act(() => {
      result.current.handleLoadMore()
    })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.logs).toHaveLength(3)
  })
})
