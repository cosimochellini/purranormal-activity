'use client'

import type { Response } from '@/app/api/log/all/route'
import type { LogWithCategories } from '@/db/schema'
import { fetcher } from '@/utils/fetch'
import { useEffect } from 'react'
import { useInView } from 'react-intersection-observer'
import { byNumber, byValue } from 'sort-es'
import { usePartialState } from '../../hooks/state'
import { distinctBy } from '../../utils/array'
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
  const [{ logs, page, hasMore, isLoading }, setState] = usePartialState<InfiniteEventsState>({
    logs: initialLogs,
    page: Math.ceil(initialLogs.length / 6) + 1,
    hasMore: true,
    isLoading: false,
  })

  const { ref, inView } = useInView()

  useEffect(() => {
    const loadMore = async () => {
      if (!inView || isLoading || !hasMore)
        return

      setState({ isLoading: true })

      try {
        const response = await getLogs({ query: { page: page.toString() } })

        if (response.success) {
          const { data, hasMore } = response
          const newLogs = distinctBy([...logs, ...data], l => l.id.toString())
            .sort(byValue(l => l.id, byNumber({ desc: true })))

          setState({ logs: newLogs, hasMore, page: page + 1 })
        }
      }
      catch {
        // TODO: handle error
      }
      finally {
        setTimeout(() => setState({ isLoading: false }), 500)
      }
    }

    loadMore()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inView, hasMore, page, isLoading])

  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {logs.map((log, index) => (
        <EventCard
          key={log.id}
          log={log}
          priority={index < 1}
          prefetch={index < 3}
        />
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
