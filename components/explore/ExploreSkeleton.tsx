import { range } from '@/utils/array'
import { EventCardSkeleton } from '../events/EventCardSkeleton'

export function ExploreSkeleton() {
  return (
    <div className="w-full space-y-8">
      {/* Filters skeleton */}
      <div className="rounded-xl border border-purple-700/30 bg-purple-900/30 p-6 backdrop-blur-xs">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {/* Search input skeleton */}
          <div className="space-y-2">
            <div className="h-5 w-32 bg-purple-800/30 rounded-sm" />
            <div className="h-10 w-full bg-purple-800/30 rounded-md" />
          </div>

          {/* Sort by skeleton */}
          <div className="space-y-2">
            <div className="h-5 w-24 bg-purple-800/30 rounded-sm" />
            <div className="h-10 w-full bg-purple-800/30 rounded-md" />
          </div>

          {/* Time range skeleton */}
          <div className="space-y-2">
            <div className="h-5 w-28 bg-purple-800/30 rounded-sm" />
            <div className="h-10 w-full bg-purple-800/30 rounded-md" />
          </div>

          {/* Categories skeleton */}
          <div className="space-y-2">
            <div className="h-5 w-24 bg-purple-800/30 rounded-sm" />
            <div className="flex flex-wrap gap-2">
              {range(4).map((i) => (
                <div key={i} className="h-9 w-24 bg-purple-800/30 rounded-full animate-pulse" />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Results skeleton */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {range(6).map((i) => (
          <EventCardSkeleton key={i} iconCount={3} />
        ))}
      </div>
    </div>
  )
}
