import type { ExploreFiltersState } from './ExploreSection'
import { SortBy, TimeRange } from '../../types/search'
import { SpookyInput } from '../common/SpookyInput'
import { SpookySelect } from '../common/SpookySelect'
import { CategorySelector } from '../editLog/CategorySelector'

interface ExploreFiltersProps {
  filters: ExploreFiltersState
  onFiltersChange: (filters: Partial<ExploreFiltersState>) => void
}

export function ExploreFilters({ filters, onFiltersChange }: ExploreFiltersProps) {
  return (
    <div className="rounded-xl border border-purple-700/30 bg-purple-900/30 p-6 backdrop-blur-sm">
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <SpookyInput
          id="search"
          label="Search Mysteries"
          value={filters.search}
          onChange={e => onFiltersChange({ search: e.target.value })}
          placeholder="Search for supernatural events..."
        />

        <SpookySelect
          id="sortBy"
          label="Sort By"
          value={filters.sortBy}
          onChange={e => onFiltersChange({ sortBy: e.target.value as SortBy })}
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
          onChange={e => onFiltersChange({ timeRange: e.target.value as TimeRange })}
          options={[
            { value: TimeRange.All, label: 'All Time' },
            { value: TimeRange.Day, label: 'Past 24 Hours' },
            { value: TimeRange.Week, label: 'Past Week' },
            { value: TimeRange.Month, label: 'Past Month' },
          ]}
        />

        <CategorySelector
          selected={filters.categories}
          onChange={categories => onFiltersChange({ categories })}
          iconsOnly
        />
      </div>
    </div>
  )
}
