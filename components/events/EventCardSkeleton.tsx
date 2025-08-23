import cn from 'classnames'
import type { HTMLProps } from 'react'
import { range } from '../../utils/array'

interface SkeletonProps extends HTMLProps<HTMLDivElement> {
  iconCount?: number
}

const baseClasses = [
  'bg-purple-900/30 backdrop-blur-xs rounded-lg p-6',
  'border border-purple-700/30 h-full animate-pulse',
  'flex flex-col justify-between',
]

export function EventCardSkeleton({ ref, className, iconCount = 3, ...props }: SkeletonProps) {
  return (
    <div ref={ref} className={cn(...baseClasses, className)} {...props}>
      <div className="relative flex justify-center mb-4">
        <div className="relative w-full aspect-square overflow-hidden rounded-md">
          <div className="w-full h-full bg-purple-800/30" />
        </div>
      </div>

      <div className="grow">
        {/* Title skeleton */}
        <div className="h-6 bg-purple-800/30 rounded-sm w-3/4 mb-2" />

        {/* Description skeleton */}
        <div className="space-y-2">
          <div className="h-4 bg-purple-800/30 rounded-sm w-full" />
          <div className="h-4 bg-purple-800/30 rounded-sm w-5/6" />
          <div className="h-4 bg-purple-800/30 rounded-sm w-4/5" />
          <div className="h-4 bg-purple-800/30 rounded-sm w-3/5" />
        </div>
      </div>

      {/* Icons skeleton */}
      <div className="flex gap-2 mt-4">
        {range(iconCount).map((i) => (
          <div key={i} className="h-6 w-6 bg-purple-800/30 rounded-full" />
        ))}
      </div>
    </div>
  )
}
