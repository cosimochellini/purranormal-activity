'use client'

import { useExploreData } from '../../hooks/useExporeData'
import { SortBy, TimeRange } from '../../types/search'
import { SpookyInput } from '../common/SpookyInput'
import { SpookySelect } from '../common/SpookySelect'
import { CategorySelector } from '../editLog/CategorySelector'

export function ExploreFilters() {
  const [filters, { setSearch, setSortBy, setTimeRange, setCategories }] = useExploreData()

  return (
    <div className="relative rounded-xl border border-purple-700/30 bg-purple-900/30 p-6 backdrop-blur-xs">
      {/* Magical sparkle effects */}
      <div className="absolute inset-0 -z-10 animate-pulse bg-linear-to-r from-purple-900/10 via-fuchsia-900/10 to-purple-900/10" />

      <div className="space-y-8">
        {/* Main filters */}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <SpookyInput
            id="search"
            label="Search Mysteries"
            value={filters.search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search for supernatural events..."
          />

          <SpookySelect
            id="sortBy"
            label="Sort By"
            value={filters.sortBy}
            onChange={(e) => setSortBy(e.target.value as SortBy)}
            options={[
              { value: SortBy.Recent, label: 'Most Recent' },
              { value: SortBy.Oldest, label: 'Oldest First' },
              { value: SortBy.Title, label: 'Alphabetical' },
            ]}
          />

          <SpookySelect
            id="timeRange"
            label="Time Range"
            value={filters.timeRange}
            onChange={(e) => setTimeRange(e.target.value as TimeRange)}
            options={[
              { value: TimeRange.All, label: 'All Time' },
              { value: TimeRange.Day, label: 'Past 24 Hours' },
              { value: TimeRange.Week, label: 'Past Week' },
              { value: TimeRange.Month, label: 'Past Month' },
            ]}
          />
        </div>

        {/* Categories section */}
        <div className="space-y-2">
          <div className="flex justify-start">
            <CategorySelector selected={filters.categories} onChange={setCategories} iconsOnly />
          </div>
        </div>
      </div>
    </div>
  )
}
