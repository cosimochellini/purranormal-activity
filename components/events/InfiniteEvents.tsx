'use client'

import type { Response } from '@/app/api/log/all/route'
import type { LogWithCategories } from '@/db/schema'
import { fetcher } from '@/utils/fetch'
import { useCallback, useEffect } from 'react'
import { useInView } from 'react-intersection-observer'
import { usePartialState } from '../../hooks/state'
import { range } from '../../utils/array'
import { EventCard } from './EventCard'
import { EventCardSkeleton } from './EventCardSkeleton'

const getLogs = fetcher<Response, { page: string; limit: string }>('/api/log/all')

interface InfiniteEventsProps {
  initialLogs: LogWithCategories[]
  initialLimit?: number
}

interface InfiniteEventsState {
  logs: LogWithCategories[]
  nextPage: number | null
  hasMore: boolean
  isLoading: boolean
  error: string | null
  retryCount: number
}

const MAX_RETRY_ATTEMPTS = 3
const ITEMS_PER_PAGE = 6

export function InfiniteEvents({
  initialLogs,
  initialLimit = ITEMS_PER_PAGE,
}: InfiniteEventsProps) {
  const [state, setState] = usePartialState<InfiniteEventsState>(() => ({
    logs: initialLogs,
    nextPage: initialLogs.length >= initialLimit ? 2 : null,
    hasMore: initialLogs.length >= initialLimit,
    isLoading: false,
    error: null,
    retryCount: 0,
  }))

  const { ref, inView } = useInView({
    threshold: 0.1,
    rootMargin: '0px 0px 300px 0px', // Load earlier for smoother experience
    triggerOnce: false,
  })

  const { logs, nextPage, hasMore, isLoading, error, retryCount } = state

  const fetchMoreLogs = useCallback(
    async (page: number, isRetry = false) => {
      if (!isRetry) {
        setState({ isLoading: true, error: null })
      }

      try {
        const response = await getLogs({
          query: {
            page: page.toString(),
            limit: ITEMS_PER_PAGE.toString(),
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
            error: null,
            retryCount: 0,
          })
        } else {
          throw new Error(response.error)
        }
      } catch (error) {
        console.error('Failed to fetch more logs:', error)

        setState({
          isLoading: false,
          error: error instanceof Error ? error.message : 'Failed to load more events',
          retryCount: isRetry ? retryCount : retryCount + 1,
        })
      }
    },
    [logs, setState, retryCount],
  )

  const handleRetry = () => {
    if (nextPage && retryCount < MAX_RETRY_ATTEMPTS) {
      fetchMoreLogs(nextPage, true)
    }
  }

  const handleLoadMore = useCallback(() => {
    if (nextPage && !isLoading && hasMore && !error) {
      fetchMoreLogs(nextPage)
    }
  }, [nextPage, isLoading, hasMore, error, fetchMoreLogs])

  // Handle intersection observer
  useEffect(() => {
    if (!inView) return

    handleLoadMore()
  }, [inView, handleLoadMore])

  const shouldShowLoadingArea = hasMore || isLoading || error
  const shouldShowSkeletons = isLoading && !error

  return (
    <div className="space-y-6">
      {/* Main grid */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {logs.map((log, index) => (
          <EventCard key={log.id} log={log} priority={index < 2} prefetch={index < 6} />
        ))}
      </div>

      {/* Loading area */}
      {shouldShowLoadingArea && (
        <div className="space-y-6">
          {/* Intersection observer trigger */}
          <div ref={ref} className="h-px" />

          {/* Loading skeletons */}
          {shouldShowSkeletons && (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {range(ITEMS_PER_PAGE).map((index) => (
                <EventCardSkeleton key={`skeleton-${index}`} />
              ))}
            </div>
          )}

          {/* Error state */}
          {error && (
            <div className="flex flex-col items-center justify-center py-8 px-4">
              <div className="text-center max-w-md">
                <div className="text-red-400 mb-2">
                  <svg
                    className="w-12 h-12 mx-auto mb-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    role="img"
                    aria-label="Warning"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
                    />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-white mb-2">Oops! Something went wrong</h3>
                <p className="text-purple-200/80 mb-4">{error}</p>
                {retryCount < MAX_RETRY_ATTEMPTS && (
                  <button
                    onClick={handleRetry}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
                    disabled={isLoading}
                  >
                    {isLoading ? 'Retrying...' : 'Try Again'}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* End of results message */}
          {!hasMore && !isLoading && !error && logs.length > 0 && (
            <div className="text-center py-8">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-purple-900/30 rounded-full mb-4">
                <svg
                  className="w-8 h-8 text-purple-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  role="img"
                  aria-label="Completed"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-white mb-2">All caught up! 🐾</h3>
              <p className="text-purple-200/80">
                You've seen all the paranormal activities for now
              </p>
            </div>
          )}
        </div>
      )}

      {/* Empty state (when no logs at all) */}
      {logs.length === 0 && !isLoading && !error && (
        <div className="text-center py-12">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-purple-900/30 rounded-full mb-6">
            <svg
              className="w-10 h-10 text-purple-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              role="img"
              aria-label="Search"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>
          <h3 className="text-xl font-medium text-white mb-3">No paranormal activities yet</h3>
          <p className="text-purple-200/80 max-w-md mx-auto">
            Your magical kitten hasn't caused any mysterious events yet. Check back later for spooky
            shenanigans!
          </p>
        </div>
      )}
    </div>
  )
}

interface InfiniteEventsSkeletonProps {
  count?: number
}

export function InfiniteEventsSkeleton({ count = 6 }: InfiniteEventsSkeletonProps) {
  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {range(count).map((index) => (
        <EventCardSkeleton key={`initial-skeleton-${index}`} />
      ))}
    </div>
  )
}
