import type { GetResponse } from '../app/api/categories/route'
import { logger } from '../utils/logger'
import { fetcher } from '../utils/fetch'

const emptyCategories: GetResponse = []
const fetchCategories = fetcher<GetResponse>('/api/categories')

export const getCategories =
  typeof window === 'undefined'
    ? Promise.resolve(emptyCategories)
    : fetchCategories().catch((error) => {
        logger.error('Failed to fetch categories:', error)

        return emptyCategories
      })
