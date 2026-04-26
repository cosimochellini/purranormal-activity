import { beforeEach, describe, expect, it, vi } from 'vitest'
import { LogStatus } from '@/data/enum/logStatus'
import { SortBy, TimeRange } from '@/types/search'

const { fakeDb } = vi.hoisted(() => {
  // Inline a minimal chainable proxy to avoid `require()` from a hoisted block
  // (which can't resolve TS sources or vite aliases).
  // biome-ignore lint/suspicious/noExplicitAny: chainable proxy needs untyped self-reference
  const proxy: Record<string, any> = {}
  const chainable = (name: string) => {
    proxy[name] = vi.fn(() => proxy)
  }
  ;[
    'select',
    'from',
    'where',
    'leftJoin',
    'innerJoin',
    'orderBy',
    'groupBy',
    'limit',
    'offset',
    'insert',
    'values',
    'update',
    'set',
    'delete',
  ].forEach(chainable)
  ;['all', 'get', 'returning', 'run', 'execute'].forEach((t) => {
    proxy[t] = vi.fn(async () => undefined)
  })
  return { fakeDb: proxy as ReturnType<typeof import('../tests/helpers.ts').makeFakeDb> }
})

vi.mock('@/drizzle', () => ({ db: fakeDb }))

import { getLog, getLogs } from './log'

const baseLog = {
  id: 1,
  title: 'A spooky cat',
  description: 'desc',
  createdAt: 1,
  updatedAt: 2,
  status: LogStatus.Created,
  error: null,
  imageDescription: null,
}

const reArmChainables = () => {
  // After clearAllMocks() the mockImplementations are wiped. Re-arm so the
  // proxy keeps chaining for non-queued calls.
  for (const key of [
    'select',
    'from',
    'where',
    'leftJoin',
    'innerJoin',
    'orderBy',
    'groupBy',
    'limit',
    'offset',
    'insert',
    'values',
    'update',
    'set',
    'delete',
  ] as const) {
    ;(fakeDb[key] as ReturnType<typeof vi.fn>).mockImplementation(() => fakeDb)
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  reArmChainables()
})

describe('getLog', () => {
  it('returns null when no entry is found', async () => {
    fakeDb.where.mockResolvedValueOnce([])

    const result = await getLog(99)
    expect(result).toBeNull()
    expect(fakeDb.where).toHaveBeenCalledTimes(1)
  })

  it('returns the merged entry with categories when found', async () => {
    fakeDb.where.mockResolvedValueOnce([baseLog])
    fakeDb.where.mockResolvedValueOnce([
      { logId: 1, categoryId: 10 },
      { logId: 1, categoryId: 11 },
    ])

    const result = await getLog(1)
    expect(result).toEqual({ ...baseLog, categories: [10, 11] })
  })

  it('returns the entry with empty categories when none are mapped', async () => {
    fakeDb.where.mockResolvedValueOnce([baseLog])
    fakeDb.where.mockResolvedValueOnce([])

    const result = await getLog(1)
    expect(result).toEqual({ ...baseLog, categories: [] })
  })
})

// Helpers: we have two distinct chains for getLogs.
// Main:           db.select().from(log).where(...).orderBy(...).limit(...).offset(skip)  // ends on offset
// addCategories:  db.select(...).from(logCategory).where(inArray(...))                    // ends on where
// When `categories` is non-empty, getLogs additionally builds a subquery
// (`db.select(...).from(logCategory).where(...).groupBy(...)`) inside a sql`` template
// — that adds one extra mid-chain `where` call before the main one.
const queueGetLogsResult = (
  logs: unknown[],
  relations: { logId: number; categoryId: number }[],
  midChainWhereCalls = 1,
) => {
  fakeDb.offset.mockResolvedValueOnce(logs)
  for (let i = 0; i < midChainWhereCalls; i += 1) {
    fakeDb.where.mockImplementationOnce(() => fakeDb)
  }
  fakeDb.where.mockResolvedValueOnce(relations)
}

describe('getLogs', () => {
  it('returns logs with merged categories using default options', async () => {
    queueGetLogsResult([baseLog], [{ logId: 1, categoryId: 5 }])

    const result = await getLogs({})
    expect(result).toEqual([{ ...baseLog, categories: [5] }])
    expect(fakeDb.orderBy).toHaveBeenCalled()
    expect(fakeDb.limit).toHaveBeenCalled()
    expect(fakeDb.offset).toHaveBeenCalled()
  })

  it('passes through skip and limit', async () => {
    queueGetLogsResult([], [])
    await getLogs({ skip: 30, limit: 5 })
    expect(fakeDb.limit).toHaveBeenCalledWith(5)
    expect(fakeDb.offset).toHaveBeenCalledWith(30)
  })

  it('applies a search filter when search is provided', async () => {
    queueGetLogsResult([], [])
    await getLogs({ search: 'kitten' })
    expect(fakeDb.where).toHaveBeenCalled()
  })

  it('applies a category filter via inner sql when categories are provided', async () => {
    // Subquery + main both consume a mid-chain where; addCategories resolves.
    queueGetLogsResult([], [], 2)
    await getLogs({ categories: [1, 2, 3] })
    expect(fakeDb.where).toHaveBeenCalled()
  })

  it.each([
    SortBy.Recent,
    SortBy.Oldest,
    SortBy.Title,
  ])('accepts sortBy=%s without error', async (sortBy) => {
    queueGetLogsResult([], [])
    const result = await getLogs({ sortBy })
    expect(result).toEqual([])
    expect(fakeDb.orderBy).toHaveBeenCalled()
  })

  it.each([
    TimeRange.All,
    TimeRange.Day,
    TimeRange.Week,
    TimeRange.Month,
  ])('accepts timeRange=%s without error', async (timeRange) => {
    queueGetLogsResult([], [])
    const result = await getLogs({ timeRange })
    expect(result).toEqual([])
  })

  it('returns an empty array (and skips category merge) when no logs match', async () => {
    queueGetLogsResult([], [])
    const result = await getLogs({})
    expect(result).toEqual([])
  })
})
