import type { Categories } from '../data/enum/category'
import type { Log } from '../db/schema'

export function getCategories(log: Log): Categories[] {
  try {
    const parsedCategories = JSON.parse(log.categories)

    return Array.isArray(parsedCategories) ? parsedCategories : []
  }
  catch {
    return []
  }
}
