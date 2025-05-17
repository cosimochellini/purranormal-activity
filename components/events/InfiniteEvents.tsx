'use client'

import type { Response } from '@/app/api/log/all/route'
import type { LogWithCategories } from '@/db/schema'
import { fetcher } from '@/utils/fetch'
import { useEffect, useRef } from 'react'
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
}

export function InfiniteEvents({ initialLogs }: InfiniteEventsProps) {
  const isLoadingRef = useRef(false)
  const [{ logs, page, hasMore }, setState] = usePartialState<InfiniteEventsState>({
    logs: initialLogs,
    page: Math.ceil(initialLogs.length / 6) + 1,
    hasMore: true,
  })

  const { ref, inView } = useInView()

  // biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
  useEffect(() => {
    const loadMore = async () => {
      if (!inView || isLoadingRef.current || !hasMore) return

      isLoadingRef.current = true

      try {
        const response = await getLogs({ query: { page: page.toString() } })

        if (response.success) {
          const { data, hasMore } = response
          const newLogs = distinctBy([...logs, ...data], (l) => l.id.toString()).sort(
            byValue((l) => l.id, byNumber({ desc: true })),
          )

          setState({ logs: newLogs, hasMore, page: page + 1 })
        }
      } catch {
        // TODO: handle error
      } finally {
        requestAnimationFrame(() => {
          isLoadingRef.current = false
        })
      }
    }

    loadMore()
  }, [inView, hasMore, page])

  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {logs.map((log, index) => (
        <EventCard key={log.id} log={log} priority={index < 1} prefetch={index < 3} />
      ))}

      {hasMore && (
        <>
          <EventCardSkeleton ref={ref} iconCount={2} />
          <EventCardSkeleton iconCount={3} />
          <EventCardSkeleton iconCount={2} />
        </>
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
