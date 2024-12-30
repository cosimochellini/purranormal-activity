import type { Categories } from '../data/enum/category'
import type { Log } from '../db/schema'

export function getCategories(log: Log) {
  try {
    return JSON.parse(log.categories) as Categories[]
  }
  catch {
    return []
  }
}
