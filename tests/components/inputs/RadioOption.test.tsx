/** @vitest-environment happy-dom */
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { RadioOption } from '@/components/inputs/RadioOption'

afterEach(() => {
  cleanup()
})

describe('RadioOption', () => {
  it('renders with label and unchecked initially', () => {
    render(
      <RadioOption
        question="how-are-you"
        answer=""
        availableAnswer="fine"
        onAnswerChange={vi.fn()}
      />,
    )
    const input = screen.getByRole('radio') as HTMLInputElement
    expect(input.checked).toBe(false)
  })

  it('reflects selected state when answer matches availableAnswer', () => {
    render(
      <RadioOption
        question="how-are-you"
        answer="fine"
        availableAnswer="fine"
        onAnswerChange={vi.fn()}
      />,
    )
    const input = screen.getByRole('radio') as HTMLInputElement
    expect(input.checked).toBe(true)
  })

  it('fires onAnswerChange with question + selected value when clicked', () => {
    const onAnswerChange = vi.fn()
    render(
      <RadioOption
        question="ghost-type"
        answer=""
        availableAnswer="poltergeist"
        onAnswerChange={onAnswerChange}
      />,
    )
    fireEvent.click(screen.getByRole('radio'))
    expect(onAnswerChange).toHaveBeenCalledWith('ghost-type', 'poltergeist')
  })

  it('handles the "Other" branch identically (selectable, fires callback)', () => {
    const onAnswerChange = vi.fn()
    render(
      <RadioOption
        question="ghost-type"
        answer=""
        availableAnswer="Other"
        onAnswerChange={onAnswerChange}
      />,
    )
    const input = screen.getByLabelText('Other') as HTMLInputElement
    expect(input.checked).toBe(false)
    fireEvent.click(input)
    expect(onAnswerChange).toHaveBeenCalledWith('ghost-type', 'Other')
  })
})
