/** @vitest-environment happy-dom */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { fetcherImpl } = vi.hoisted(() => ({ fetcherImpl: vi.fn() }))
vi.mock('@/utils/fetch', () => ({
  fetcher: () => fetcherImpl,
}))

import { InitialSection } from '@/components/newLog/initial'

beforeEach(() => {
  fetcherImpl.mockReset()
})

afterEach(() => {
  cleanup()
})

describe('InitialSection — Bug #6 regression', () => {
  it('does not crash and does not call onNext when refineLog rejects', async () => {
    fetcherImpl.mockRejectedValueOnce(new Error('network down'))
    const onNext = vi.fn()

    render(
      <InitialSection onNext={onNext} description={'A long enough description for valid input.'} />,
    )

    fireEvent.click(screen.getByRole('button', { name: /Record Supernatural Event/i }))

    await waitFor(() => {
      expect(fetcherImpl).toHaveBeenCalled()
    })

    // An error message should appear (modal text or inline). Wait for it.
    await waitFor(() => {
      expect(screen.getByText(/Unable to connect to the server/i)).toBeInTheDocument()
    })

    // onNext is NOT called on rejection
    expect(onNext).not.toHaveBeenCalled()
  })

  it('does not call onNext when response.success is false (response.content not read)', async () => {
    fetcherImpl.mockResolvedValueOnce({
      success: false,
      errors: { description: ['Too short for refining'] },
    })
    const onNext = vi.fn()

    render(
      <InitialSection onNext={onNext} description={'A long enough description for valid input.'} />,
    )
    fireEvent.click(screen.getByRole('button', { name: /Record Supernatural Event/i }))

    await waitFor(() => {
      expect(fetcherImpl).toHaveBeenCalled()
    })

    // Modal should open and onNext should not be called
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })
    expect(onNext).not.toHaveBeenCalled()
  })
})
