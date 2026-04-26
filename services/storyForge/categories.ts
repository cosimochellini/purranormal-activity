import { type Category, category } from '@/db/schema'
import { db as defaultDb } from '@/drizzle'
import type { CategoriesPort } from './types'

interface DbLike {
  select(): {
    from(t: typeof category): Promise<Category[]>
  }
}

export function createDefaultCategories(
  db: DbLike = defaultDb as unknown as DbLike,
): CategoriesPort {
  let cache: Category[] | null = null
  let inFlight: Promise<Category[]> | null = null
  let token = 0

  return {
    async all() {
      if (cache && cache.length > 0) return cache
      if (inFlight) return inFlight

      const myToken = token
      const fetchPromise: Promise<Category[]> = db
        .select()
        .from(category)
        .then((rows) => {
          // Skip caching if invalidate() ran during the in-flight fetch:
          // the rows we just received may already be stale.
          if (myToken === token) cache = rows
          return rows
        })
        .finally(() => {
          if (inFlight === fetchPromise) inFlight = null
        })
      inFlight = fetchPromise
      return fetchPromise
    },
    invalidate() {
      cache = null
      inFlight = null
      token++
    },
  }
}
