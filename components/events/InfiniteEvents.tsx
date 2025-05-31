'use client'

import type { Response } from '@/app/api/log/all/route'
import type { LogWithCategories } from '@/db/schema'
import { fetcher } from '@/utils/fetch'
import { useEffect } from 'react'
import { useInView } from 'react-intersection-observer'
import { byNumber, byValue } from 'sort-es'
import { usePartialState } from '../../hooks/state'
import { distinctBy, range } from '../../utils/array'
import { EventCard } from './EventCard'
import { EventCardSkeleton } from './EventCardSkeleton'

const getLogs = fetcher<Response, { page: string }>('/api/log/all')

interface InfiniteEventsProps {
  initialLogs: LogWithCategories[]
}

interface InfiniteEventsState {
  logs: LogWithCategories[]
  page: number
  hasMore: boolean
  isLoading: boolean
}

export function InfiniteEvents({ initialLogs }: InfiniteEventsProps) {
  const [state, setState] = usePartialState<InfiniteEventsState>({
    logs: initialLogs,
    page: Math.ceil(initialLogs.length / 6) + 1,
    hasMore: initialLogs.length > 0, // Assume there's more if we have initial logs
    isLoading: false,
  })

  const { logs, page, hasMore, isLoading } = state

  const { ref, inView } = useInView({
    threshold: 0.1,
    rootMargin: '0px 0px 200px 0px', // Load earlier for smoother experience
  })

  const fetchMoreLogs = async () => {
    if (!hasMore || isLoading) return

    setState({ isLoading: true })

    try {
      const response = await getLogs({ query: { page: page.toString() } })

      if (response.success) {
        const { data } = response

        // If we got fewer items than expected or none, mark that we have no more data
        const newHasMore = data.length > 0

        const newLogs = distinctBy([...logs, ...data], (l) => l.id.toString()).sort(
          byValue((l) => l.id, byNumber({ desc: true })),
        )

        setState({
          logs: newLogs,
          page: page + 1,
          hasMore: newHasMore,
        })
      }
    } catch (error) {
      console.error('Failed to fetch more logs:', error)
    } finally {
      setState({ isLoading: false })
    }
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: no need to add additional checks
  useEffect(() => {
    if (inView && !isLoading && hasMore) {
      fetchMoreLogs()
    }
  }, [inView])

  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {logs.map((log, index) => (
        <EventCard key={log.id} log={log} priority={index < 1} prefetch={index < 3} />
      ))}

      {hasMore && (
        <div ref={ref} className="col-span-full flex justify-center py-4">
          {isLoading ? (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 w-full">
              <EventCardSkeleton iconCount={2} />
              <EventCardSkeleton iconCount={3} />
              <EventCardSkeleton iconCount={2} />
            </div>
          ) : (
            // Invisible element to trigger intersection
            <div className="h-20" />
          )}
        </div>
      )}

      {!hasMore && logs.length > 0 && (
        <div className="col-span-full text-center py-6 text-neutral-500">
          No more events to load
        </div>
      )}
    </div>
  )
}

interface InfiniteEventsSkeletonProps {
  iconCount: number
}

export function InfiniteEventsSkeleton({ iconCount }: InfiniteEventsSkeletonProps) {
  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {range(iconCount).map((index) => (
        <EventCardSkeleton key={index} />
      ))}
    </div>
  )
}
