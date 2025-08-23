'use client'

import type { LogWithCategories } from '@/db/schema'
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll'
import { range } from '@/utils/array'

import { EventCard } from './EventCard'
import { EventCardSkeleton } from './EventCardSkeleton'
import { IntersectionTrigger } from './IntersectionTrigger'
import { LoadingState } from './LoadingState'

interface InfiniteEventsProps {
  initialLogs: LogWithCategories[]
  initialLimit: number
}

export function InfiniteEvents({ initialLogs, initialLimit }: InfiniteEventsProps) {
  const { logs, hasMore, isLoading, handleLoadMore } = useInfiniteScroll({
    initialLogs,
    initialLimit,
  })

  const shouldShowLoadingArea = hasMore || isLoading
  const shouldShowSkeletons = isLoading
  const shouldShowIntersectionTrigger = hasMore && !isLoading

  return (
    <div className="space-y-6">
      {/* Main grid */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {logs.map((log, index) => (
          <EventCard key={log.id} log={log} priority={index < 2} prefetch={index < 6} />
        ))}
      </div>

      {/* Loading area */}
      {shouldShowLoadingArea && (
        <div className="space-y-6">
          {/* Intersection observer trigger - only show when we can actually load more */}
          {shouldShowIntersectionTrigger && (
            <IntersectionTrigger
              onIntersect={handleLoadMore}
              disabled={!shouldShowIntersectionTrigger}
            />
          )}

          {/* Loading skeletons */}
          <LoadingState count={initialLimit} showSkeletons={shouldShowSkeletons} />
        </div>
      )}
    </div>
  )
}

interface InfiniteEventsSkeletonProps {
  count?: number
}

export function InfiniteEventsSkeleton({ count = 6 }: InfiniteEventsSkeletonProps) {
  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {range(count).map((index) => (
        <EventCardSkeleton key={`initial-skeleton-${index}`} />
      ))}
    </div>
  )
}
