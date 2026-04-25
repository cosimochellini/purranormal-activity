/** @vitest-environment happy-dom */
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// fetcher mock — captures aborted-signal flag so tests can assert race control.
const { fetcherImpl } = vi.hoisted(() => ({ fetcherImpl: vi.fn() }))
vi.mock('@/utils/fetch', () => ({
  fetcher: () => fetcherImpl,
}))

// useExploreData mock returns a controllable filters tuple.
const { exploreState } = vi.hoisted(() => ({
  exploreState: {
    page: 1,
    limit: 10,
    search: '',
    categories: [] as number[],
    sortBy: 'recent',
    timeRange: 'all',
  },
}))
vi.mock('@/hooks/useExploreData', () => ({
  useExploreData: () => [exploreState, {}],
}))

// EventCard stub
vi.mock('@/components/events/EventCard', () => ({
  EventCard: ({ log }: { log: { id: number; title: string } }) => (
    <div data-testid={`event-card-${log.id}`}>{log.title}</div>
  ),
}))

// NoLogsFound stub
vi.mock('../../../components/explore/NoLogsFound', () => ({
  NoLogsFound: () => <div data-testid="no-logs">none</div>,
}))

// Loading stub
vi.mock('@/components/common/Loading', () => ({
  Loading: () => <div data-testid="loading">loading</div>,
}))

import { ExploreResults } from '@/components/explore/ExploreResults'
import { logger } from '@/utils/logger'

beforeEach(() => {
  fetcherImpl.mockReset()
  // Reset shared explore state to defaults
  exploreState.page = 1
  exploreState.limit = 10
  exploreState.search = ''
  exploreState.categories = []
  exploreState.sortBy = 'recent'
  exploreState.timeRange = 'all'
})

afterEach(() => {
  cleanup()
})

const fakeLog = (id: number, title = `t${id}`) => ({
  id,
  title,
  description: `desc-${id}`,
  status: 'created',
  imageDescription: '',
  createdAt: 0,
  updatedAt: 0,
  error: null,
  categories: [],
})

describe('ExploreResults — Bug #3 regression', () => {
  it('aborts in-flight requests when filters change rapidly; only latest renders', async () => {
    // First call: never resolves until aborted; capture its signal
    let firstSignal: AbortSignal | undefined
    fetcherImpl.mockImplementationOnce(({ signal }: { signal: AbortSignal }) => {
      firstSignal = signal
      return new Promise(() => {
        /* hang */
      })
    })
    fetcherImpl.mockResolvedValueOnce({
      success: true,
      data: [fakeLog(2, 'second')],
      hasMore: false,
      nextPage: null,
    })

    const { rerender } = render(<ExploreResults />)

    // Trigger a rerender with changed search to start a second request and abort the first.
    exploreState.search = 'ghost'
    rerender(<ExploreResults />)

    await waitFor(() => {
      expect(screen.getByTestId('event-card-2')).toBeInTheDocument()
    })

    expect(firstSignal?.aborted).toBe(true)
    // The card from the (never-resolved) first request must NOT be in the DOM.
    expect(screen.queryByTestId('event-card-1')).toBeNull()
  })
})

describe('ExploreResults — Bug #13 regression', () => {
  it('routes fetch errors through logger.error (not console.error)', async () => {
    fetcherImpl.mockRejectedValueOnce(new Error('boom'))

    render(<ExploreResults />)

    await waitFor(() => {
      expect(vi.mocked(logger.error)).toHaveBeenCalled()
    })

    const calledArgs = vi.mocked(logger.error).mock.calls.flat()
    const calledWithBoom = calledArgs.some((a) => a instanceof Error && a.message === 'boom')
    expect(calledWithBoom).toBe(true)
  })
})
