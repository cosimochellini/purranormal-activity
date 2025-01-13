import { ExploreFilters } from './ExploreFilters'
import { ExploreResults } from './ExploreResults'

export function ExploreSection() {
  return (
    <div className="w-full space-y-8">
      <ExploreFilters />
      <ExploreResults />
    </div>
  )
}
