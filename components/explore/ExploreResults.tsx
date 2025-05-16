'use client'

import type { LogWithCategories } from '@/db/schema'
import type { Query, Response } from '../../app/api/log/all/route'

import { fetcher } from '@/utils/fetch'
import { useEffect, useState } from 'react'
import { useExploreData } from '../../hooks/useExporeData'
import { Loading } from '../common/Loading'
import { EventCard } from '../events/EventCard'
import { NoLogsFound } from './NoLogsFound'

const searchLogs = fetcher<Response, Query>('/api/log/all')

export function ExploreResults() {
  const [{ page, limit, search, categories, sortBy, timeRange }] = useExploreData()
  const [logs, setLogs] = useState<LogWithCategories[]>([])
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    const getItems = async () => {
      setIsLoading(true)
      try {
        const response = await searchLogs({
          query: { page, limit, search, categories, sortBy, timeRange },
        })

        if (!response.success) throw new Error(response.error)

        setLogs(response.data)
      } catch (error) {
        console.error('Failed to search logs:', error)
        setLogs([])
      } finally {
        setIsLoading(false)
      }
    }

    if (isLoading) return

    getItems()
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
