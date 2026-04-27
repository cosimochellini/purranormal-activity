import type { CategoriesGetResponse } from '../types/api/categories'
import { fetcher } from '../utils/fetch'
import { logger } from '../utils/logger'

const emptyCategories: CategoriesGetResponse = []
const fetchCategoriesClient = fetcher<CategoriesGetResponse>('/api/categories')

const fetchCategoriesOnServer = async (): Promise<CategoriesGetResponse> => {
  const [{ db }, { category }] = await Promise.all([import('../drizzle'), import('../db/schema')])
  return db.select().from(category)
}

let cached: Promise<CategoriesGetResponse> | undefined

/**
 * Lazily-initialised, memoised categories promise. The first caller fires
 * the fetch (DB on the server, `/api/categories` on the client); every
 * subsequent caller in the same Worker / page lifetime re-uses it. Wrapped
 * in a function (rather than an eagerly-evaluated `export const`) so that
 * a route which never renders the categories list does not pay the DB /
 * fetch cost at module-load time.
 */
export const getCategories = (): Promise<CategoriesGetResponse> => {
  if (cached) return cached
  cached = (import.meta.env.SSR ? fetchCategoriesOnServer() : fetchCategoriesClient()).catch(
    (error) => {
      logger.error('Failed to fetch categories:', error)
      return emptyCategories
    },
  )
  return cached
}
