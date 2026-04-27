import { type Category, category } from '@/db/schema'
import { db as defaultDb } from '@/drizzle'
import type { CategoriesPort } from './types'

interface DbLike {
  select(): {
    from(t: typeof category): Promise<Category[]>
  }
}

// `structuredClone` is Workers-native; it is preferred over a manual
// `{...row}` shallow copy so that a future schema change adding a nested
// field to `Category` cannot silently re-introduce a shared-reference leak.
const cloneRow = (row: Category): Category => structuredClone(row)
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
      // We deliberately do NOT memoise an empty result — a fresh
      // environment whose `category` table has not been seeded yet should
      // re-query on each call until at least one row exists, so seed-time
      // races (or admin POST /api/categories before the cache populates)
      // do not strand the user with a synthetic empty list. Once
      // categories exist, the cache reuses them and subsequent
      // invalidate() calls (e.g. from POST /api/categories) drop it.
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
