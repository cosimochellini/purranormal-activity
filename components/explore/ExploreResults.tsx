import type { LogWithCategories } from '@/db/schema'
import type { Query, Response } from '../../app/api/log/all/route'
import type { ExploreFiltersState } from './ExploreSection'
import { fetcher } from '@/utils/fetch'
import { useEffect, useState } from 'react'
import { byNumber, byValue } from 'sort-es'
import { SortBy } from '../../types/search'
import { Loading } from '../common/Loading'
import { EventCard } from '../events/EventCard'

interface ExploreResultsProps {
  filters: ExploreFiltersState
}

const searchLogs = fetcher<Response, Query>('/api/log/all')

export function ExploreResults({ filters }: ExploreResultsProps) {
  const [logs, setLogs] = useState<LogWithCategories[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const search = async () => {
      setIsLoading(true)
      try {
        const response = await searchLogs({
          query: {
            search: filters.search,
            categories: filters.categories.map(c => c.id).join(',').toString(),
            sortBy: filters.sortBy,
            timeRange: filters.timeRange,
          },
        })

        if (response.success) {
          const sortedLogs = response.data.sort(
            byValue(l => l.id, byNumber({ desc: filters.sortBy === SortBy.Recent })),
          )
          setLogs(sortedLogs)
        }
      }
      catch (error) {
        console.error('Failed to search logs:', error)
        setLogs([])
      }
      finally {
        setIsLoading(false)
      }
    }

    search()
  }, [filters])

  if (isLoading)
    return <Loading />

  if (logs.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-purple-200/80">
          No supernatural events found matching your criteria...
        </p>
      </div>
    )
  }

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
    </div>
  )
}
