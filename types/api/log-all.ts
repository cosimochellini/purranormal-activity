import type { LogWithCategories } from '@/db/schema'
import type { SortBy, TimeRange } from '@/types/search'

type QueryValue = string | null | number | undefined | QueryValue[]

export type LogAllQuery = Record<string, QueryValue> & {
  page: number
  limit: number
  search: string
  categories: number[]
  sortBy: SortBy
  timeRange: TimeRange
}

export type LogAllResponse =
  | {
      success: true
      data: LogWithCategories[]
      hasMore: boolean
      nextPage: number | null
    }
  | {
      success: false
      error: string
    }
