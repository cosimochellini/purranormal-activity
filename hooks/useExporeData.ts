import {
  parseAsArrayOf,
  parseAsInteger,
  parseAsString,
  parseAsStringEnum,
  useQueryState,
} from 'nuqs'
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
const emptyArray: number[] = []
const throttleMs = time({ seconds: 1 })

export function useExploreData() {
  const [page, setPage] = useQueryState('page', parseAsInteger.withDefault(1))
  const [limit, setLimit] = useQueryState('limit', parseAsInteger.withDefault(10))
  const [search, setSearch] = useQueryState(
    'search',
    parseAsString.withDefault('').withOptions({ throttleMs }),
  )

  const [categories, setCategories] = useQueryState(
    'categories',
    parseAsArrayOf(parseAsInteger).withDefault(emptyArray),
  )
  const [sortBy, setSortBy] = useQueryState(
    'sortBy',
    parseAsStringEnum<SortBy>(typedObjectValues(SortBy)).withDefault(SortBy.Recent),
  )

  const [timeRange, setTimeRange] = useQueryState(
    'timeRange',
    parseAsStringEnum<TimeRange>(typedObjectValues(TimeRange)).withDefault(TimeRange.All),
  )

  return [
    { page, limit, search, categories, sortBy, timeRange },
    { setPage, setLimit, setSearch, setCategories, setSortBy, setTimeRange },
  ] as const
}
