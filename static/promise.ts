import type { CategoriesGetResponse } from '../types/api/categories'
import { fetcher } from '../utils/fetch'
import { logger } from '../utils/logger'

const emptyCategories: CategoriesGetResponse = []
const fetchCategories = fetcher<CategoriesGetResponse>('/api/categories')

export const getCategories = import.meta.env.SSR
  ? import('../services/categories')
      .then((module) => module.getCategories())
      .catch((error) => {
        logger.error('Failed to fetch categories on server:', error)
        return emptyCategories
      })
  : fetchCategories().catch((error) => {
      logger.error('Failed to fetch categories:', error)
      return emptyCategories
    })
