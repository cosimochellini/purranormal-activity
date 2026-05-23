import {
  parseAsArrayOf,
  parseAsInteger,
  parseAsString,
  parseAsStringEnum,
  useQueryStates,
} from 'nuqs'
import { useCallback } from 'react'
import { SortBy, TimeRange } from '../types/search'
import { time } from '../utils/time'
import { typedObjectValues } from '../utils/typed'

export interface ExploreFiltersState {
  page: number
  limit: number
  search: string
  categories: number[]
  sortBy: SortBy
  timeRange: TimeRange
}

export interface UseExploreFilters {
  filters: ExploreFiltersState
  setFilters: (partial: Partial<ExploreFiltersState>) => Promise<URLSearchParams>
  reset: () => Promise<URLSearchParams>
}

const emptyArray: number[] = []
const throttleMs = time({ seconds: 1 })

const defaults: ExploreFiltersState = {
  page: 1,
  limit: 10,
  search: '',
  categories: emptyArray,
  sortBy: SortBy.Recent,
  timeRange: TimeRange.All,
}

// Keys whose change resets `page` back to 1 unless an explicit `page` is provided.
const pageResettingKeys = ['search', 'categories', 'sortBy', 'timeRange', 'limit'] as const

export const useExploreFilters = (): UseExploreFilters => {
  const [filters, setQueryStates] = useQueryStates({
    page: parseAsInteger.withDefault(defaults.page),
    limit: parseAsInteger.withDefault(defaults.limit),
    search: parseAsString.withDefault(defaults.search).withOptions({ throttleMs }),
    categories: parseAsArrayOf(parseAsInteger).withDefault(defaults.categories),
    sortBy: parseAsStringEnum<SortBy>(typedObjectValues(SortBy)).withDefault(defaults.sortBy),
    timeRange: parseAsStringEnum<TimeRange>(typedObjectValues(TimeRange)).withDefault(
      defaults.timeRange,
    ),
  })

  const setFilters = useCallback(
    (partial: Partial<ExploreFiltersState>) => {
      const shouldResetPage =
        partial.page === undefined && pageResettingKeys.some((k) => k in partial)

      return setQueryStates(shouldResetPage ? { ...partial, page: 1 } : partial)
    },
    [setQueryStates],
  )

  const reset = useCallback(() => setQueryStates({ ...defaults }), [setQueryStates])

  return { filters, setFilters, reset }
}
