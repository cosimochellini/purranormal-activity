/** @vitest-environment happy-dom */
import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// The `/explore` loader hands the component a promise of the page's results.
const { loaderData } = vi.hoisted(() => ({
  loaderData: { results: undefined as unknown as Promise<unknown> },
}))
vi.mock('@tanstack/react-router', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@tanstack/react-router')>()),
  getRouteApi: () => ({ useLoaderData: () => loaderData }),
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

beforeEach(() => {
  loaderData.results = Promise.resolve({ logs: [], hasMore: false, nextPage: null })
})

afterEach(() => {
  cleanup()
})

// `use` suspends on the first render even for a settled promise; flushing inside
// an async `act` lets React retry it deterministically.
const renderResults = async () => {
  await act(async () => {
    render(<ExploreResults />)
  })
}

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

describe('ExploreResults', () => {
  it('renders one card per log from the resolved loader promise', async () => {
    loaderData.results = Promise.resolve({
      logs: [fakeLog(1, 'first'), fakeLog(2, 'second')],
      hasMore: false,
      nextPage: null,
    })

    await renderResults()

    expect(screen.getByTestId('event-card-1')).toHaveTextContent('first')
    expect(screen.getByTestId('event-card-2')).toHaveTextContent('second')
    expect(screen.queryByTestId('no-logs')).toBeNull()
  })

  it('renders NoLogsFound for an empty page', async () => {
    await renderResults()

    expect(screen.getByTestId('no-logs')).toBeInTheDocument()
    expect(screen.queryByTestId(/^event-card-/)).toBeNull()
  })

  it('shows the Loading fallback while the promise is pending', async () => {
    let resolve!: (value: unknown) => void
    loaderData.results = new Promise((r) => {
      resolve = r
    })

    await renderResults()

    expect(screen.getByTestId('loading')).toBeInTheDocument()
    expect(screen.queryByTestId('no-logs')).toBeNull()

    await act(async () => {
      resolve({ logs: [fakeLog(3)], hasMore: false, nextPage: null })
    })

    expect(screen.getByTestId('event-card-3')).toBeInTheDocument()
    expect(screen.queryByTestId('loading')).toBeNull()
  })
})

describe('ExploreResults — failed page', () => {
  it('shows an inline error instead of unmounting the route', async () => {
    const failed = Promise.reject(new Error('Failed to fetch logs'))
    failed.catch(() => {})
    loaderData.results = failed
    // React logs caught boundary errors; keep the test output quiet.
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    await act(async () => {
      render(<ExploreResults />)
    })

    expect(screen.getByRole('alert')).toHaveTextContent('The archives are unreachable')
    consoleError.mockRestore()
  })
})
