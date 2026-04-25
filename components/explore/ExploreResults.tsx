import { useEffect, useState } from 'react'
import type { LogWithCategories } from '@/db/schema'
import type { LogAllQuery, LogAllResponse } from '@/types/api/log-all'

import { fetcher } from '@/utils/fetch'
import { logger } from '@/utils/logger'
import { useExploreData } from '../../hooks/useExploreData'
import { Loading } from '../common/Loading'
import { EventCard } from '../events/EventCard'
import { NoLogsFound } from './NoLogsFound'

const searchLogs = fetcher<LogAllResponse, LogAllQuery>('/api/log/all')

export function ExploreResults() {
  const [{ page, limit, search, categories, sortBy, timeRange }] = useExploreData()
  const [logs, setLogs] = useState<LogWithCategories[]>([])
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    const controller = new AbortController()

    const getItems = async () => {
      setIsLoading(true)
      try {
        const response = await searchLogs({
          query: { page, limit, search, categories, sortBy, timeRange },
          signal: controller.signal,
        })

        if (controller.signal.aborted) return

        if (!response.success) throw new Error(response.error)

        setLogs(response.data)
      } catch (error) {
        if (controller.signal.aborted) return
        logger.error('Failed to search logs:', error)
        setLogs([])
      } finally {
        if (!controller.signal.aborted) setIsLoading(false)
      }
    }

    getItems()

    return () => controller.abort()
  }, [page, limit, search, categories, sortBy, timeRange])

  if (isLoading) return <Loading />

  if (!logs.length) return <NoLogsFound />

  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {logs.map((log, index) => (
        <EventCard key={log.id} log={log} priority={index < 1} prefetch={index < 3} />
      ))}
    </div>
  )
}
