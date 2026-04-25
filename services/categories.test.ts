import { beforeEach, describe, expect, it, vi } from 'vitest'

const { fakeDb } = vi.hoisted(() => {
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
  return { fakeDb: proxy }
})

vi.mock('@/drizzle', () => ({ db: fakeDb }))

import { __resetCategoryCache, getCategories, getCategoriesMap, getCategory } from './categories'

const sampleCategories = [
  { id: 1, name: 'magic', icon: '✨', createdAt: 1, updatedAt: 1 },
  { id: 2, name: 'mystery', icon: '🔮', createdAt: 1, updatedAt: 1 },
  { id: 3, name: 'spooky', icon: '👻', createdAt: 1, updatedAt: 1 },
]

const reArmChainables = () => {
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
  ]) {
    ;(fakeDb[key as keyof typeof fakeDb] as ReturnType<typeof vi.fn>).mockImplementation(
      () => fakeDb,
    )
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  reArmChainables()
  __resetCategoryCache()
})

describe('getCategoriesMap', () => {
  it('queries the DB on the first call and populates the cache', async () => {
    // Chain: db.select().from(category) — ends on .from(), which is awaited.
    // Drizzle treats the chain as a thenable; in the fake, awaiting `.from(...)`
    // gets resolved by overriding `.from`'s next call to a Promise.
    fakeDb.from.mockResolvedValueOnce(sampleCategories)

    const map = await getCategoriesMap()
    expect(map.size).toBe(3)
    expect(map.get(1)?.name).toBe('magic')
    expect(fakeDb.select).toHaveBeenCalledTimes(1)
  })

  it('does NOT re-query the DB on a second call (cached)', async () => {
    fakeDb.from.mockResolvedValueOnce(sampleCategories)
    await getCategoriesMap()
    fakeDb.select.mockClear()
    fakeDb.from.mockClear()

    const map2 = await getCategoriesMap()
    expect(map2.size).toBe(3)
    expect(fakeDb.select).not.toHaveBeenCalled()
  })

  it('re-queries when force=true', async () => {
    fakeDb.from.mockResolvedValueOnce(sampleCategories)
    await getCategoriesMap()

    const refreshed = [{ id: 9, name: 'new', icon: '🆕', createdAt: 1, updatedAt: 1 }]
    fakeDb.from.mockResolvedValueOnce(refreshed)
    const map = await getCategoriesMap(true)
    expect(map.size).toBe(1)
    expect(map.get(9)?.name).toBe('new')
  })

  // Bug #15 regression: __resetCategoryCache() must clear the module-level
  // cache so the next non-forced getCategoriesMap() call hits the DB again.
  it('after __resetCategoryCache the next call queries the DB again (Bug #15)', async () => {
    fakeDb.from.mockResolvedValueOnce(sampleCategories)
    await getCategoriesMap()
    expect(fakeDb.select).toHaveBeenCalledTimes(1)

    __resetCategoryCache()

    fakeDb.from.mockResolvedValueOnce(sampleCategories)
    await getCategoriesMap()
    expect(fakeDb.select).toHaveBeenCalledTimes(2)
  })

  it('does NOT cache an empty result (re-queries until one row exists)', async () => {
    // First call returns empty — cachedCategories?.size is falsy, so the next
    // call re-queries.
    fakeDb.from.mockResolvedValueOnce([])
    const empty = await getCategoriesMap()
    expect(empty.size).toBe(0)

    fakeDb.from.mockResolvedValueOnce(sampleCategories)
    const filled = await getCategoriesMap()
    expect(filled.size).toBe(3)
  })
})

describe('getCategory', () => {
  it('returns the category for an id present in the cache', async () => {
    fakeDb.from.mockResolvedValueOnce(sampleCategories)
    const cat = await getCategory(2)
    expect(cat).toMatchObject({ id: 2, name: 'mystery' })
  })

  it('returns undefined for an unknown id', async () => {
    fakeDb.from.mockResolvedValueOnce(sampleCategories)
    const cat = await getCategory(999)
    expect(cat).toBeUndefined()
  })
})

describe('getCategories', () => {
  it('returns all values when ids is null', async () => {
    fakeDb.from.mockResolvedValueOnce(sampleCategories)
    const result = await getCategories(null)
    expect(result).toHaveLength(3)
  })

  it('returns the categories matching the supplied ids in order', async () => {
    fakeDb.from.mockResolvedValueOnce(sampleCategories)
    const result = await getCategories([3, 1])
    expect(result.map((c) => c.id)).toEqual([3, 1])
  })

  it('filters out unknown ids', async () => {
    fakeDb.from.mockResolvedValueOnce(sampleCategories)
    const result = await getCategories([1, 999, 2])
    expect(result.map((c) => c.id)).toEqual([1, 2])
  })

  it('uses defaults (returns all) when called with no argument', async () => {
    fakeDb.from.mockResolvedValueOnce(sampleCategories)
    const result = await getCategories()
    expect(result).toHaveLength(3)
  })
})
