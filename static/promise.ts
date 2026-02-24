import type { CategoriesGetResponse } from '../types/api/categories'
import { fetcher } from '../utils/fetch'
import { logger } from '../utils/logger'

const emptyCategories: CategoriesGetResponse = []
const fetchCategories = fetcher<CategoriesGetResponse>('/api/categories')

export const getCategories =
  typeof window === 'undefined'
    ? Promise.resolve(emptyCategories)
    : fetchCategories().catch((error) => {
        logger.error('Failed to fetch categories:', error)

        return emptyCategories
      })
