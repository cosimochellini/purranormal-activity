/** @vitest-environment happy-dom */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { fetcherImpls } = vi.hoisted(() => ({
  fetcherImpls: {
    addCategories: vi.fn(),
    addLogCategories: vi.fn(),
  },
}))

vi.mock('@/utils/fetch', () => ({
  fetcher: (url: string) => {
    if (url === '/api/categories') return fetcherImpls.addCategories
    if (url === '/api/log/[id]/categories') return fetcherImpls.addLogCategories
    return vi.fn()
  },
}))

import { MissingCategoriesModal } from '@/components/newLog/MissingCategoriesModal'

beforeEach(() => {
  fetcherImpls.addCategories.mockReset()
  fetcherImpls.addLogCategories.mockReset()
})

afterEach(() => {
  cleanup()
})

describe('MissingCategoriesModal — Bug #5 regression', () => {
  it('renders an error and stays open when addLogCategories fails', async () => {
    fetcherImpls.addCategories.mockResolvedValueOnce({
      success: true,
      categories: [{ id: 7, name: 'newCat' }],
    })
    fetcherImpls.addLogCategories.mockResolvedValueOnce({
      success: false,
      errors: { categories: ['Could not link categories'] },
    })

    const onClose = vi.fn()

    render(
      <MissingCategoriesModal open logId={1} onClose={onClose} missingCategories={['newCat']} />,
    )

    // Toggle the category to "selected"
    fireEvent.click(screen.getByText('newCat'))

    // Click Save
    fireEvent.click(screen.getByRole('button', { name: /Save/i }))

    // Wait for the second call to settle and the error to appear
    await waitFor(() => {
      expect(fetcherImpls.addLogCategories).toHaveBeenCalled()
    })

    await waitFor(() => {
      expect(screen.getByTestId('missing-categories-error')).toBeInTheDocument()
    })
    expect(screen.getByTestId('missing-categories-error')).toHaveTextContent(
      /Could not link categories/i,
    )

    // Modal stays open — onClose was NOT auto-called
    expect(onClose).not.toHaveBeenCalled()
  })
})
