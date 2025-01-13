'use client'

import type { Category } from '@/db/schema'
import { useDeferredValue } from 'react'
import { usePartialState } from '../../hooks/state'
import { SortBy, TimeRange } from '../../types/search'
import { ExploreFilters } from './ExploreFilters'
import { ExploreResults } from './ExploreResults'

export interface ExploreFiltersState {
  search: string
  categories: Category[]
  sortBy: SortBy
  timeRange: TimeRange
}

const defaultFilters = {
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
