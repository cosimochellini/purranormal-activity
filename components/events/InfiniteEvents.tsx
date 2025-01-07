'use client'

import type { Response } from '@/app/api/log/all/route'
import type { Log } from '@/db/schema'
import { fetcher } from '@/utils/fetch'
import { useEffect, useState } from 'react'
import { useInView } from 'react-intersection-observer'
import { EventCard } from './EventCard'
import { EventCardSkeleton } from './EventCardSkeleton'

const getLogs = fetcher<Response, { page: string }>('/api/log/all')

export function InfiniteEvents() {
  const [logs, setLogs] = useState<Log[]>([])
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const [isLoading, setIsLoading] = useState(false)
  const { ref, inView } = useInView()

  useEffect(() => {
    const loadMore = async () => {
      if (!inView || isLoading || !hasMore)
        return

      setIsLoading(true)
      try {
        const response = await getLogs({ query: { page: `${page + 1}` } })

        if (response.success) {
          setLogs(prev => [...prev, ...response.data])
          setHasMore(response.hasMore)
          setPage(prev => prev + 1)
        }
      }
      catch (error) {
        console.error('Failed to load more logs:', error)
      }
      finally {
        setIsLoading(false)
      }
    }

    loadMore()
  }, [inView, isLoading, hasMore, page])

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
          <div ref={ref} className="h-1" />
          <EventCardSkeleton />
          <EventCardSkeleton />
          <EventCardSkeleton />
        </>
      )}
    </div>
  )
}
