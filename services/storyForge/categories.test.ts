import { describe, expect, it, vi } from 'vitest'
import type { Category } from '@/db/schema'

vi.mock('@/drizzle', () => ({ db: {} }))

import { createDefaultCategories } from './categories'

const sampleCategories: Category[] = [
  { id: 1, name: 'magic', icon: '✨', createdAt: 1, updatedAt: 1 },
  { id: 2, name: 'mystery', icon: '🔮', createdAt: 1, updatedAt: 1 },
  { id: 3, name: 'spooky', icon: '👻', createdAt: 1, updatedAt: 1 },
]

const fakeDb = (rows: Category[] | (() => Promise<Category[]>)) => {
  const select = vi.fn(() => ({
    from: vi.fn(() => (typeof rows === 'function' ? rows() : Promise.resolve(rows))),
  }))
  return { select }
}

describe('createDefaultCategories', () => {
  it('queries the DB on first call and caches', async () => {
    const db = fakeDb(sampleCategories)
    // biome-ignore lint/suspicious/noExplicitAny: test-only DbLike satisfies the production signature
    const cats = createDefaultCategories(db as any)

    const first = await cats.all()
    expect(first).toHaveLength(3)
    expect(db.select).toHaveBeenCalledTimes(1)

    const second = await cats.all()
    // Defensive copy — equal contents, not the same reference, so
    // downstream mutators cannot poison the shared cache.
    expect(second).toEqual(first)
    expect(second).not.toBe(first)
    expect(db.select).toHaveBeenCalledTimes(1)
  })

  it('does NOT memoize an empty result', async () => {
    let pool: Category[] = []
    const db = fakeDb(() => Promise.resolve(pool))
    // biome-ignore lint/suspicious/noExplicitAny: test-only
    const cats = createDefaultCategories(db as any)

    const empty = await cats.all()
    expect(empty).toEqual([])

    pool = sampleCategories
    const filled = await cats.all()
    expect(filled).toHaveLength(3)
    expect(db.select).toHaveBeenCalledTimes(2)
  })

  it('re-fetches after invalidate()', async () => {
    let counter = 0
    const db = fakeDb(() => {
      counter++
      return Promise.resolve(sampleCategories)
    })
    // biome-ignore lint/suspicious/noExplicitAny: test-only
    const cats = createDefaultCategories(db as any)

    await cats.all()
    await cats.all()
    expect(counter).toBe(1)

    cats.invalidate()
    await cats.all()
    expect(counter).toBe(2)
  })

  it('coalesces concurrent in-flight all() callers into a single DB read', async () => {
    let resolveDb: (value: Category[]) => void = () => {}
    const dbPromise = new Promise<Category[]>((resolve) => {
      resolveDb = resolve
    })
    let calls = 0
    const db = {
      select: vi.fn(() => ({
        from: vi.fn(() => {
          calls++
          return dbPromise
        }),
      })),
    }
    // biome-ignore lint/suspicious/noExplicitAny: test-only
    const cats = createDefaultCategories(db as any)

    const a = cats.all()
    const b = cats.all()
    const c = cats.all()
    expect(calls).toBe(1)

    resolveDb(sampleCategories)
    const [ra, rb, rc] = await Promise.all([a, b, c])
    expect(ra).toEqual(sampleCategories)
    expect(rb).toEqual(sampleCategories)
    expect(rc).toEqual(sampleCategories)
    expect(calls).toBe(1)
  })

  it('concurrent invalidate during in-flight all() does not poison the cache', async () => {
    let resolveDb: (value: Category[]) => void = () => {}
    const dbPromise = new Promise<Category[]>((resolve) => {
      resolveDb = resolve
    })
    let calls = 0
    const db = {
      select: vi.fn(() => ({
        from: vi.fn(() => {
          calls++
          if (calls === 1) return dbPromise
          return Promise.resolve(sampleCategories)
        }),
      })),
    }
    // biome-ignore lint/suspicious/noExplicitAny: test-only
    const cats = createDefaultCategories(db as any)

    const inFlight = cats.all()
    cats.invalidate()
    resolveDb(sampleCategories)
    const fetched = await inFlight
    expect(fetched).toEqual(sampleCategories)

    // Cache should still be empty because invalidate ran during the in-flight fetch.
    const next = await cats.all()
    expect(next).toEqual(sampleCategories)
    expect(calls).toBe(2)
  })
})
