import { beforeEach, describe, expect, it, vi } from 'vitest'
import { EXPLORE_DEFAULTS, SortBy, TimeRange } from '@/types/search'

vi.mock('@/drizzle', () => ({ db: {} }))
vi.mock('@/services/imagePipeline', () => ({ imagePipeline: {} }))
vi.mock('@/services/imageStore/r2.server', () => ({ imageStore: {} }))
vi.mock('@/services/notifier', () => ({ notifier: {} }))
vi.mock('@/services/storyForge', () => ({ storyForge: {} }))
vi.mock('@/services/log', () => ({
  getLog: vi.fn(),
  getLogs: vi.fn(),
}))

import { getLogs } from '@/services/log'
import { listLogs } from '@/services/logActions.server'

describe('listLogs', () => {
  beforeEach(() => {
    vi.mocked(getLogs).mockReset()
  })

  it('returns the paginated payload on success (page 1, default limit)', async () => {
    const fakeRows = Array.from({ length: 10 }, (_, i) => ({ id: i, categories: [] }))
    vi.mocked(getLogs).mockResolvedValueOnce(fakeRows as never)

    expect(await listLogs(EXPLORE_DEFAULTS)).toEqual({
      logs: fakeRows,
      hasMore: true,
      nextPage: 2,
    })

    expect(getLogs).toHaveBeenCalledWith({
      skip: 0,
      limit: 10,
      search: '',
      categories: [],
      sortBy: SortBy.Recent,
      timeRange: TimeRange.All,
    })
  })

  it('passes filters through and reports no more pages on a short page', async () => {
    const rows = [{ id: 1, categories: [] }]
    vi.mocked(getLogs).mockResolvedValueOnce(rows as never)

    const result = await listLogs({
      page: 3,
      limit: 5,
      search: 'ghost',
      categories: [1, 2],
      sortBy: SortBy.Oldest,
      timeRange: TimeRange.Week,
    })

    expect(result).toEqual({ logs: rows, hasMore: false, nextPage: null })
    expect(getLogs).toHaveBeenCalledWith({
      skip: 10, // (page-1)*limit = 2*5
      limit: 5,
      search: 'ghost',
      categories: [1, 2],
      sortBy: SortBy.Oldest,
      timeRange: TimeRange.Week,
    })
  })

  it('advances nextPage from the requested page when the page is full', async () => {
    const rows = Array.from({ length: 5 }, (_, i) => ({ id: i, categories: [] }))
    vi.mocked(getLogs).mockResolvedValueOnce(rows as never)

    const result = await listLogs({ ...EXPLORE_DEFAULTS, page: 3, limit: 5 })

    expect(result.hasMore).toBe(true)
    expect(result.nextPage).toBe(4)
  })

  it('returns an empty last page with no next page', async () => {
    vi.mocked(getLogs).mockResolvedValueOnce([])

    expect(await listLogs(EXPLORE_DEFAULTS)).toEqual({ logs: [], hasMore: false, nextPage: null })
  })

  it('throws when the service throws (loaders surface it via the error boundary)', async () => {
    vi.mocked(getLogs).mockRejectedValueOnce(new Error('db down'))

    await expect(listLogs(EXPLORE_DEFAULTS)).rejects.toThrow('db down')
  })
})
