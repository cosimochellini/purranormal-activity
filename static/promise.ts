import type { CategoriesGetResponse } from '../types/api/categories'
import { fetcher } from '../utils/fetch'
import { logger } from '../utils/logger'

const emptyCategories: CategoriesGetResponse = []
const fetchCategories = fetcher<CategoriesGetResponse>('/api/categories')

const fetchCategoriesOnServer = async (): Promise<CategoriesGetResponse> => {
  const [{ db }, { category }] = await Promise.all([import('../drizzle'), import('../db/schema')])
  return db.select().from(category)
}

export const getCategories = import.meta.env.SSR
  ? fetchCategoriesOnServer().catch((error) => {
      logger.error('Failed to fetch categories on server:', error)
      return emptyCategories
    })
  : fetchCategories().catch((error) => {
      logger.error('Failed to fetch categories:', error)
      return emptyCategories
    })
