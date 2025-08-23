import { range } from '@/utils/array'
import { EventCardSkeleton } from './EventCardSkeleton'

interface LoadingStateProps {
  count?: number
  showSkeletons?: boolean
}

export function LoadingState({ count = 6, showSkeletons = true }: LoadingStateProps) {
  if (!showSkeletons) {
    return null
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {range(count).map((index) => (
          <EventCardSkeleton key={`loading-skeleton-${index}`} />
        ))}
      </div>
    </div>
  )
}
