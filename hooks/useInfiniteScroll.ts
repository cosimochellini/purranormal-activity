import { useCallback } from 'react'
import type { LogWithCategories } from '@/db/schema'
import { listLogs } from '@/start/services/logs'
import { usePartialState } from './state'

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
        const response = await listLogs({ data: { page, limit: initialLimit } })

        // Filter out any duplicates (though this should be rare with proper pagination)
        const newLogs = response.logs.filter((log) => !logs.some((l) => l.id === log.id))

        setState({
          logs: [...logs, ...newLogs],
          nextPage: response.nextPage,
          hasMore: response.hasMore,
          isLoading: false,
        })
      } catch (_error) {
        // Stop paging. The sentinel would otherwise remount, fire again while
        // still in view, and hammer a failing server in a tight loop.
        setState({ isLoading: false, hasMore: false })
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
