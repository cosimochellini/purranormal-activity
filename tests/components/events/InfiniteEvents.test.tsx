/** @vitest-environment happy-dom */
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Stub the infinite-scroll hook to drive the visibility branch directly.
const { hookState } = vi.hoisted(() => ({
  hookState: {
    logs: [] as Array<{ id: number; title: string }>,
    hasMore: true,
    isLoading: false,
    handleLoadMore: vi.fn(),
  },
}))
vi.mock('@/hooks/useInfiniteScroll', () => ({
  useInfiniteScroll: () => ({
    logs: hookState.logs,
    hasMore: hookState.hasMore,
    isLoading: hookState.isLoading,
    handleLoadMore: hookState.handleLoadMore,
  }),
}))

vi.mock('@/components/events/EventCard', () => ({
  EventCard: ({ log }: { log: { id: number; title: string } }) => (
    <div data-testid={`event-card-${log.id}`}>{log.title}</div>
  ),
}))

vi.mock('@/components/events/EventCardSkeleton', () => ({
  EventCardSkeleton: () => <div data-testid="skeleton" />,
}))

vi.mock('@/components/events/IntersectionTrigger', () => ({
  IntersectionTrigger: ({ disabled }: { disabled: boolean }) => (
    <div data-testid="intersection-trigger" data-disabled={disabled ? 'true' : 'false'} />
  ),
}))

vi.mock('@/components/events/LoadingState', () => ({
  LoadingState: ({ showSkeletons }: { showSkeletons: boolean }) =>
    showSkeletons ? <div data-testid="loading-state" /> : null,
}))

import { InfiniteEvents } from '@/components/events/InfiniteEvents'

beforeEach(() => {
  hookState.logs = [{ id: 1, title: 'one' }]
  hookState.hasMore = true
  hookState.isLoading = false
  hookState.handleLoadMore.mockReset()
})

afterEach(() => {
  cleanup()
})

describe('InfiniteEvents — Bug #9 regression', () => {
  it('hasMore=true and isLoading=false → trigger visible and not disabled', () => {
    render(<InfiniteEvents initialLogs={[]} initialLimit={5} />)
    const trigger = screen.getByTestId('intersection-trigger')
    expect(trigger).toBeInTheDocument()
    expect(trigger.getAttribute('data-disabled')).toBe('false')
  })

  it('hasMore=false → trigger hidden', () => {
    hookState.hasMore = false
    render(<InfiniteEvents initialLogs={[]} initialLimit={5} />)
    expect(screen.queryByTestId('intersection-trigger')).toBeNull()
  })

  it('hasMore=true and isLoading=true → trigger hidden, skeletons shown', () => {
    hookState.hasMore = true
    hookState.isLoading = true
    render(<InfiniteEvents initialLogs={[]} initialLimit={5} />)
    expect(screen.queryByTestId('intersection-trigger')).toBeNull()
    expect(screen.getByTestId('loading-state')).toBeInTheDocument()
  })
})
