'use client'

import { useDeferredValue } from 'react'
import { usePartialState } from '../../hooks/state'
import { SortBy, TimeRange } from '../../types/search'
import { ExploreFilters } from './ExploreFilters'
import { ExploreResults } from './ExploreResults'

export interface ExploreFiltersState {
  page: number
  limit: number
  search: string
  categories: number[]
  sortBy: SortBy
  timeRange: TimeRange
}

const defaultFilters = {
  page: 1,
  limit: 10,
  search: '',
  categories: [],
  sortBy: SortBy.Recent,
  timeRange: TimeRange.All,
} as const satisfies ExploreFiltersState

export function ExploreSection() {
  const [filters, setFilters] = usePartialState<ExploreFiltersState>(defaultFilters)
  const debouncedSearch = useDeferredValue(filters.search)

  return (
    <div className="w-full space-y-8">
      <ExploreFilters
        filters={filters}
        onFiltersChange={setFilters}
      />
      <ExploreResults
        filters={{ ...filters, search: debouncedSearch }}
      />
    </div>
  )
}
