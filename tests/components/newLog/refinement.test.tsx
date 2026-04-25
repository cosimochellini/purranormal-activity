/** @vitest-environment happy-dom */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { fetcherImpl } = vi.hoisted(() => ({ fetcherImpl: vi.fn() }))
vi.mock('@/utils/fetch', () => ({
  fetcher: () => fetcherImpl,
}))

import { RefinementSection } from '@/components/newLog/refinement'

beforeEach(() => {
  fetcherImpl.mockReset()
})

afterEach(() => {
  cleanup()
})

const questions = [
  {
    question: 'What kind of ghost?',
    availableAnswers: ['friendly', 'mischievous'],
  },
]

describe('RefinementSection — Bug #7 regression', () => {
  it('selecting "Other" without text shows an error and does not call submit', async () => {
    const onNext = vi.fn()

    render(
      <RefinementSection
        description={'A spooky description'}
        questions={questions}
        onNext={onNext}
      />,
    )

    // Click the "Other" radio for the first question
    const otherRadio = screen.getByLabelText('Other') as HTMLInputElement
    fireEvent.click(otherRadio)

    // Click the submit button (Save event)
    const saveBtn = screen.getByRole('button', { name: /Save event/i })
    fireEvent.click(saveBtn)

    // The per-field error must surface
    await waitFor(() => {
      expect(screen.getByTestId(`question-error-${questions[0].question}`)).toBeInTheDocument()
    })

    // No API call was made (submit blocked)
    expect(fetcherImpl).not.toHaveBeenCalled()
    expect(onNext).not.toHaveBeenCalled()
  })

  it('selecting "Other" with valid text proceeds to call submit', async () => {
    fetcherImpl.mockResolvedValueOnce({
      success: true,
      id: 42,
      missingCategories: [],
    })
    const onNext = vi.fn()

    render(
      <RefinementSection
        description={'A spooky description'}
        questions={questions}
        onNext={onNext}
      />,
    )

    fireEvent.click(screen.getByLabelText('Other') as HTMLInputElement)

    const textarea = screen.getByPlaceholderText(/Specify other details/i) as HTMLTextAreaElement
    fireEvent.change(textarea, { target: { value: 'A poltergeist' } })

    fireEvent.click(screen.getByRole('button', { name: /Save event/i }))

    await waitFor(() => {
      expect(fetcherImpl).toHaveBeenCalled()
    })
    await waitFor(() => {
      expect(onNext).toHaveBeenCalledWith({ logId: 42, missingCategories: [] })
    })
  })
})
