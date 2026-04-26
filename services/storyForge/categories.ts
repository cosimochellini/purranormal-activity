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
  let token = 0

  return {
    async all() {
      if (cache && cache.length > 0) return cache
      const myToken = token
      const rows = await db.select().from(category)
      // If invalidate() ran while we were awaiting, do not poison the cache
      // with the now-stale rows: the next caller will re-fetch.
      if (myToken === token) cache = rows
      return rows
    },
    invalidate() {
      cache = null
      token++
    },
  }
}
