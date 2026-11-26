/** @vitest-environment happy-dom */
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { EXPLORE_DEFAULTS, type ExploreSearch, SortBy } from '@/types/search'

const { search, navigate } = vi.hoisted(() => ({
  search: {} as ExploreSearch,
  navigate: vi.fn(),
}))
vi.mock('@tanstack/react-router', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@tanstack/react-router')>()),
  getRouteApi: () => ({ useSearch: () => search, useNavigate: () => navigate }),
}))

// The category chips are covered on their own; this stub only reports changes.
vi.mock('@/components/editLog/CategorySelector', () => ({
  CategorySelector: ({ onChange }: { onChange: (categories: number[]) => void }) => (
    <button type="button" onClick={() => onChange([3])}>
      pick-category
    </button>
  ),
}))

import { ExploreFilters } from '@/components/explore/ExploreFilters'

// The URL the user is on: page 3, so any filter change has a page to reset.
const current = { ...EXPLORE_DEFAULTS, page: 3, sortBy: SortBy.Oldest }

beforeEach(() => {
  vi.useFakeTimers()
  Object.assign(search, current)
  navigate.mockReset()
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

const type = (value: string) =>
  fireEvent.change(screen.getByLabelText('Search Mysteries'), { target: { value } })

const wait = (ms: number) =>
  act(() => {
    vi.advanceTimersByTime(ms)
  })

// What the router would compute for `navigate({ search: fn })` from the current URL.
const navigatedSearch = (call: number) => {
  const options = navigate.mock.calls[call][0] as {
    search: (prev: ExploreSearch) => ExploreSearch
    replace: boolean
  }
  return { next: options.search(current), replace: options.replace }
}

describe('ExploreFilters — debounced search', () => {
  it('updates the input at once and navigates once after 400ms, back on page 1', () => {
    render(<ExploreFilters />)

    type('ghost')

    expect(screen.getByLabelText('Search Mysteries')).toHaveValue('ghost')
    wait(399)
    expect(navigate).not.toHaveBeenCalled()

    wait(1)
    expect(navigate).toHaveBeenCalledTimes(1)
    const { next, replace } = navigatedSearch(0)
    expect(next).toEqual({ ...current, search: 'ghost', page: 1 })
    // Typing must not pile up history entries.
    expect(replace).toBe(true)
  })

  it('coalesces keystrokes inside the window into a single navigation', () => {
    render(<ExploreFilters />)

    type('g')
    wait(300)
    type('gh')
    wait(300)
    type('ghost')
    expect(navigate).not.toHaveBeenCalled()

    wait(400)
    expect(navigate).toHaveBeenCalledTimes(1)
    expect(navigatedSearch(0).next.search).toBe('ghost')
  })

  it('does not navigate when the text already matches the URL', () => {
    search.search = 'ghost'
    render(<ExploreFilters />)

    type('ghost')
    wait(1000)

    expect(navigate).not.toHaveBeenCalled()
  })
})

describe('ExploreFilters — other filters', () => {
  it('a sort change navigates immediately and resets the page', () => {
    render(<ExploreFilters />)

    fireEvent.change(screen.getByLabelText('Sort By'), { target: { value: SortBy.Title } })

    expect(navigate).toHaveBeenCalledTimes(1)
    expect(navigatedSearch(0).next).toEqual({ ...current, sortBy: SortBy.Title, page: 1 })
  })

  it('a category change navigates immediately and resets the page', () => {
    render(<ExploreFilters />)

    fireEvent.click(screen.getByRole('button', { name: 'pick-category' }))

    expect(navigate).toHaveBeenCalledTimes(1)
    expect(navigatedSearch(0).next).toEqual({ ...current, categories: [3], page: 1 })
  })
})
