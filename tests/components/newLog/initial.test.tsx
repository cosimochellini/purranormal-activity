/** @vitest-environment happy-dom */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { VALIDATION_MESSAGES } from '@/constants'

const { refineLog } = vi.hoisted(() => ({ refineLog: vi.fn() }))
vi.mock('@/start/services/logs', () => ({ refineLog }))
vi.mock('@tanstack/react-start', () => ({ useServerFn: (fn: unknown) => fn }))

import { InitialSection } from '@/components/newLog/initial'

const DESCRIPTION = 'A long enough description for valid input.'

beforeEach(() => {
  refineLog.mockReset()
})

afterEach(() => {
  cleanup()
})

const submit = () =>
  fireEvent.click(screen.getByRole('button', { name: /Record Supernatural Event/i }))

describe('InitialSection — Bug #6 regression', () => {
  it('does not crash and does not call onNext when refineLog rejects', async () => {
    refineLog.mockRejectedValueOnce(new Error('network down'))
    const onNext = vi.fn()

    render(<InitialSection onNext={onNext} description={DESCRIPTION} />)
    submit()

    await waitFor(() => {
      expect(refineLog).toHaveBeenCalled()
    })

    // An error message should appear (modal text or inline). Wait for it.
    await waitFor(() => {
      expect(screen.getByText(/Unable to connect to the server/i)).toBeInTheDocument()
    })

    // onNext is NOT called on rejection
    expect(onNext).not.toHaveBeenCalled()
  })

  it('does not call onNext when response.success is false (response.content not read)', async () => {
    refineLog.mockResolvedValueOnce({
      success: false,
      errors: { description: ['Too short for refining'] },
    })
    const onNext = vi.fn()

    render(<InitialSection onNext={onNext} description={DESCRIPTION} />)
    submit()

    await waitFor(() => {
      expect(refineLog).toHaveBeenCalled()
    })

    // Modal should open and onNext should not be called
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })
    expect(onNext).not.toHaveBeenCalled()
  })
})

describe('InitialSection — submit', () => {
  it('sends the description to refineLog and hands the questions to onNext', async () => {
    const questions = [{ question: 'What kind of ghost?', availableAnswers: ['friendly'] }]
    refineLog.mockResolvedValueOnce({ success: true, content: questions })
    const onNext = vi.fn()

    render(<InitialSection onNext={onNext} description={DESCRIPTION} />)
    submit()

    await waitFor(() => {
      expect(onNext).toHaveBeenCalledWith({ description: DESCRIPTION, questions })
    })
    expect(refineLog).toHaveBeenCalledWith({ data: { description: DESCRIPTION } })
  })

  it('blocks a too-short description client-side without calling refineLog', async () => {
    render(<InitialSection onNext={vi.fn()} description="" />)
    submit()

    expect(await screen.findByText(VALIDATION_MESSAGES.DESCRIPTION_REQUIRED)).toBeInTheDocument()
    expect(refineLog).not.toHaveBeenCalled()
  })
})
