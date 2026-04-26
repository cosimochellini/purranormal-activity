import { type Category, category } from '@/db/schema'
import { db as defaultDb } from '@/drizzle'
import type { CategoriesPort } from './types'

interface DbLike {
  select(): {
    from(t: typeof category): Promise<Category[]>
  }
}

const cloneRow = (row: Category): Category => ({ ...row })
const cloneRows = (rows: Category[]): Category[] => rows.map(cloneRow)

export function createDefaultCategories(
  db: DbLike = defaultDb as unknown as DbLike,
): CategoriesPort {
  let cache: Category[] | null = null
  let inFlight: Promise<Category[]> | null = null
  let token = 0

  return {
    async all() {
      // Return per-row copies so a downstream mutator (e.g. `.sort()`,
      // `obj.name = 'X'`) cannot poison the shared cached references.
      if (cache && cache.length > 0) return cloneRows(cache)
      if (inFlight) return inFlight.then(cloneRows)

      const myToken = token
      const fetchPromise: Promise<Category[]> = db
        .select()
        .from(category)
        .then((rows) => {
          // Skip caching if invalidate() ran during the in-flight fetch:
          // the rows we just received may already be stale. `invalidate()`
          // intentionally does NOT cancel an in-flight fetch — the
          // already-awaited callers still receive the fetched rows so
          // we don't surface a synthetic "no categories" to them.
          if (myToken === token) cache = rows
          return rows
        })
        .finally(() => {
          if (inFlight === fetchPromise) inFlight = null
        })
      inFlight = fetchPromise
      return fetchPromise.then(cloneRows)
    },
    invalidate() {
      cache = null
      inFlight = null
      token++
    },
  }
}
