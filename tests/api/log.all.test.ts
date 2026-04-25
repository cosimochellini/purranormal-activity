import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SortBy, TimeRange } from '@/types/search'

vi.mock('@/services/log', () => ({
  getLogs: vi.fn(),
}))

import { getLogs } from '@/services/log'
import { Route } from '@/start/routes/api/log/all'

const GET = Route.options.server?.handlers?.GET as (ctx: { request: Request }) => Promise<Response>

const callGet = (qs = '') =>
  GET({ request: new Request(`http://test/api/log/all${qs}`, { method: 'GET' }) })

describe('GET /api/log/all', () => {
  beforeEach(() => {
    vi.mocked(getLogs).mockReset()
  })

  it('returns the paginated payload on success (page 1, default limit)', async () => {
    const fakeRows = Array.from({ length: 10 }, (_, i) => ({ id: i, categories: [] }))
    vi.mocked(getLogs).mockResolvedValueOnce(fakeRows as never)

    const res = await callGet('')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      success: true,
      data: fakeRows,
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

  it('passes through filters from the query string and reports no more pages', async () => {
    vi.mocked(getLogs).mockResolvedValueOnce([{ id: 1, categories: [] }] as never)

    const res = await callGet(
      '?page=3&limit=5&search=ghost&categories=1,2&sortBy=oldest&timeRange=week',
    )
    const body = (await res.json()) as { success: true; hasMore: boolean; nextPage: number | null }
    expect(body.success).toBe(true)
    expect(body.hasMore).toBe(false)
    expect(body.nextPage).toBeNull()

    expect(getLogs).toHaveBeenCalledWith({
      skip: 10, // (page-1)*limit = 2*5
      limit: 5,
      search: 'ghost',
      categories: [1, 2],
      sortBy: SortBy.Oldest,
      timeRange: TimeRange.Week,
    })
  })

  it('returns success:false when the query schema cannot parse', async () => {
    const res = await callGet('?sortBy=not-a-sort')
    const body = (await res.json()) as { success: false; error: string }
    expect(body.success).toBe(false)
    expect(typeof body.error).toBe('string')
    expect(body.error.length).toBeGreaterThan(0)
    expect(getLogs).not.toHaveBeenCalled()
  })

  it('returns success:false when the service throws', async () => {
    vi.mocked(getLogs).mockRejectedValueOnce(new Error('db down'))

    const res = await callGet('')
    expect(await res.json()).toEqual({ success: false, error: 'Failed to fetch logs' })
  })
})
