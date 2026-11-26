/** @vitest-environment happy-dom */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { VALIDATION_MESSAGES } from '@/constants'

const { submitLog, invalidateTags, router } = vi.hoisted(() => ({
  submitLog: vi.fn(),
  invalidateTags: vi.fn(),
  router: { invalidate: vi.fn() },
}))
vi.mock('@/start/services/logs', () => ({ submitLog }))
vi.mock('@tanstack/react-start', () => ({ useServerFn: (fn: unknown) => fn }))
vi.mock('@/utils/invalidation', () => ({ invalidateTags }))
vi.mock('@tanstack/react-router', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@tanstack/react-router')>()),
  useRouter: () => router,
}))

import { RefinementSection } from '@/components/newLog/refinement'

beforeEach(() => {
  submitLog.mockReset()
  invalidateTags.mockReset()
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
    expect(submitLog).not.toHaveBeenCalled()
    expect(onNext).not.toHaveBeenCalled()
  })

  it('selecting "Other" with valid text proceeds to call submit', async () => {
    submitLog.mockResolvedValueOnce({ success: true, id: 42 })
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
      expect(submitLog).toHaveBeenCalledWith({
        data: {
          description: 'A spooky description',
          answers: [{ question: questions[0].question, answer: 'A poltergeist' }],
          secret: '',
        },
      })
    })
    await waitFor(() => {
      expect(onNext).toHaveBeenCalledWith({ logId: 42 })
    })
    // A saved log makes the list routes stale.
    expect(invalidateTags).toHaveBeenCalledWith(router, ['logs'])
  })
})

describe('RefinementSection — secret gate', () => {
  it('renders a thrown SECRET_INVALID under the secret field, not in the error modal', async () => {
    submitLog.mockRejectedValueOnce(new Error(VALIDATION_MESSAGES.SECRET_INVALID))
    const onNext = vi.fn()

    render(
      <RefinementSection
        description={'A spooky description'}
        questions={questions}
        onNext={onNext}
      />,
    )

    fireEvent.click(screen.getByLabelText('friendly'))
    fireEvent.change(screen.getByLabelText('Secret'), { target: { value: 'wrong' } })
    fireEvent.click(screen.getByRole('button', { name: /Save event/i }))

    const message = await screen.findByText(VALIDATION_MESSAGES.SECRET_INVALID)
    // Same container as the input, i.e. under the secret field.
    expect(message.closest('.space-y-2')).toContainElement(screen.getByLabelText('Secret'))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(onNext).not.toHaveBeenCalled()
    expect(invalidateTags).not.toHaveBeenCalled()
  })
})
