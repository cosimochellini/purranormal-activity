/** @vitest-environment happy-dom */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import * as React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { fetcherImpls } = vi.hoisted(() => ({
  fetcherImpls: {
    update: vi.fn(),
    delete: vi.fn(),
    upload: vi.fn(),
  },
}))

vi.mock('@/utils/fetch', () => ({
  fetcher: (url: string, method?: string) => {
    if (url === '/api/log/[id]' && method === 'PUT') return fetcherImpls.update
    if (url === '/api/log/[id]' && method === 'DELETE') return fetcherImpls.delete
    if (url === '/api/upload/[id]') return fetcherImpls.upload
    return vi.fn()
  },
}))

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => vi.fn(async () => {}),
  useRouter: () => ({ invalidate: vi.fn() }),
  Link: ({ children, ...rest }: { children: React.ReactNode } & Record<string, unknown>) =>
    React.createElement('a', rest as Record<string, unknown>, children),
}))

// Stub heavy children
vi.mock('@/components/events/EventImage', () => ({
  EventImage: () => <div data-testid="event-image" />,
}))
vi.mock('@/components/editLog/CategorySelector', () => ({
  CategorySelector: () => <div data-testid="category-selector" />,
  CategorySelectorSkeleton: () => <div data-testid="category-skeleton" />,
}))

import { EditLogForm } from '@/components/editLog'

const initialData = {
  id: 1,
  title: 'Title',
  description: 'desc',
  imageDescription: 'img desc',
  status: 'created',
  error: null,
  createdAt: 0,
  updatedAt: 0,
  categories: [],
}

beforeEach(() => {
  fetcherImpls.update.mockReset()
  fetcherImpls.delete.mockReset()
  fetcherImpls.upload.mockReset()
})

afterEach(() => {
  cleanup()
})

describe('EditLogForm — Bug #8 regression', () => {
  it('delete failure resets only submitting.delete, not submitting.form', async () => {
    // Form is in-flight (slow promise) so submitting.form = true
    let resolveUpdate: (v: unknown) => void = () => {}
    fetcherImpls.update.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveUpdate = resolve
        }),
    )

    // Delete fails immediately
    fetcherImpls.delete.mockRejectedValueOnce(new Error('delete failed'))

    const { container } = render(<EditLogForm initialData={initialData as never} />)

    const findDeleteBtn = () => screen.getByRole('button', { name: /Delete/i })
    const findSaveSubmitBtn = () =>
      container.querySelector('button[type="submit"]') as HTMLButtonElement

    // Submit form → submitting.form becomes true (kept due to pending update)
    fireEvent.click(findSaveSubmitBtn())

    await waitFor(() => {
      expect(fetcherImpls.update).toHaveBeenCalled()
    })

    // Click Delete → submitting.delete becomes true → fails → finally resets ONLY delete
    fireEvent.click(findDeleteBtn())

    // Wait for delete handler to settle
    await waitFor(() => {
      expect(fetcherImpls.delete).toHaveBeenCalled()
    })

    // After delete-fail finally: submitting.form must remain true (not reset).
    // The submit button should remain disabled (Loading state) while the update is pending.
    await waitFor(() => {
      expect(findSaveSubmitBtn()).toBeDisabled()
    })

    // The Delete button should be re-enabled (its own flag was reset).
    await waitFor(() => {
      expect(findDeleteBtn()).not.toBeDisabled()
    })

    // Cleanup pending update
    resolveUpdate({ success: true })
  })
})
