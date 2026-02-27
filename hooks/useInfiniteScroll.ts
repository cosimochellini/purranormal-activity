import { useCallback } from 'react'
import type { LogWithCategories } from '@/db/schema'
import type { LogAllResponse } from '@/types/api/log-all'
import { fetcher } from '@/utils/fetch'
import { usePartialState } from './state'

const getLogs = fetcher<LogAllResponse, { page: string; limit: string }>('/api/log/all')

interface UseInfiniteScrollState {
  logs: LogWithCategories[]
  nextPage: number | null
  hasMore: boolean
  isLoading: boolean
}

interface UseInfiniteScrollOptions {
  initialLogs: LogWithCategories[]
  initialLimit: number
}

export function useInfiniteScroll({ initialLogs, initialLimit }: UseInfiniteScrollOptions) {
  const [state, setState] = usePartialState<UseInfiniteScrollState>(() => ({
    logs: initialLogs,
    nextPage: initialLogs.length >= initialLimit ? 2 : null,
    hasMore: initialLogs.length >= initialLimit,
    isLoading: false,
  }))

  const { logs, nextPage, hasMore, isLoading } = state

  const fetchMoreLogs = useCallback(
    async (page: number) => {
      setState({ isLoading: true })

      try {
        const response = await getLogs({
          query: {
            page: page.toString(),
            limit: initialLimit.toString(),
          },
        })

        if (response.success) {
          const { data, hasMore: apiHasMore, nextPage: apiNextPage } = response

          // Filter out any duplicates (though this should be rare with proper pagination)
          const newLogs = data.filter((log) => !logs.some((l) => l.id === log.id))

          setState({
            logs: [...logs, ...newLogs],
            nextPage: apiNextPage,
            hasMore: apiHasMore,
            isLoading: false,
          })
        }
      } catch (_error) {
        // Just set loading to false and continue
        setState({ isLoading: false })
      }
    },
    [logs, setState, initialLimit],
  )

  const handleLoadMore = useCallback(() => {
    const canLoadMore = nextPage && !isLoading && hasMore

    if (canLoadMore) {
      fetchMoreLogs(nextPage)
    }
  }, [nextPage, isLoading, hasMore, fetchMoreLogs])

  return {
    logs,
    nextPage,
    hasMore,
    isLoading,
    handleLoadMore,
  } as const
}
