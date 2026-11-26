/** @vitest-environment happy-dom */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { VALIDATION_MESSAGES } from '@/constants'

const { notifyLog, play } = vi.hoisted(() => ({ notifyLog: vi.fn(), play: vi.fn() }))
vi.mock('@/start/services/logs', () => ({ notifyLog }))
vi.mock('@tanstack/react-start', () => ({ useServerFn: (fn: unknown) => fn }))
vi.mock('@/hooks/useSound', () => ({ useSound: () => ({ play }) }))

import { SendNotificationButton } from '@/components/common/SendNotificationButton'

beforeEach(() => {
  notifyLog.mockReset()
  play.mockReset()
})

afterEach(() => {
  cleanup()
})

// Opens the modal and returns the secret field and its form.
const openModal = () => {
  fireEvent.click(screen.getByRole('button', { name: /Send Notification/i }))
  const secret = screen.getByLabelText('Secret') as HTMLInputElement
  return { secret, form: secret.closest('form') as HTMLFormElement }
}

describe('SendNotificationButton', () => {
  it('asks for the secret first and does not notify until it is submitted', () => {
    render(<SendNotificationButton logId={7} />)

    expect(screen.queryByRole('dialog')).toBeNull()
    const { secret } = openModal()

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(secret).toHaveAttribute('type', 'password')
    expect(notifyLog).not.toHaveBeenCalled()
  })

  it('sends the id and secret, then shows the outcome and plays the sound', async () => {
    notifyLog.mockResolvedValueOnce({ success: true, messageId: 99 })
    render(<SendNotificationButton logId={7} />)

    const { secret, form } = openModal()
    fireEvent.change(secret, { target: { value: 's3cret' } })
    fireEvent.submit(form)

    expect(await screen.findByText('Notification Sent!')).toBeInTheDocument()
    expect(screen.getByText(/Message ID: 99/)).toBeInTheDocument()
    expect(notifyLog).toHaveBeenCalledWith({ data: { id: 7, secret: 's3cret' } })
    expect(play).toHaveBeenCalledTimes(1)
  })

  it('renders a thrown SECRET_INVALID under the secret field and keeps the form open', async () => {
    notifyLog.mockRejectedValueOnce(new Error(VALIDATION_MESSAGES.SECRET_INVALID))
    render(<SendNotificationButton logId={7} />)

    const { secret, form } = openModal()
    fireEvent.change(secret, { target: { value: 'wrong' } })
    fireEvent.submit(form)

    const message = await screen.findByText(VALIDATION_MESSAGES.SECRET_INVALID)
    // SpookyInput renders its error as a sibling of the input.
    expect(message.previousElementSibling).toBe(secret)
    expect(screen.queryByText('Notification Failed')).toBeNull()
    expect(play).not.toHaveBeenCalled()

    // Typing again clears the stale message.
    fireEvent.change(secret, { target: { value: 'wrong2' } })
    expect(screen.queryByText(VALIDATION_MESSAGES.SECRET_INVALID)).toBeNull()
  })

  it('shows other failures in the result view, not under the secret field', async () => {
    notifyLog.mockRejectedValueOnce(new Error('telegram down'))
    render(<SendNotificationButton logId={7} />)

    const { secret, form } = openModal()
    fireEvent.change(secret, { target: { value: 's3cret' } })
    fireEvent.submit(form)

    expect(await screen.findByText('Notification Failed')).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.getByText('telegram down')).toBeInTheDocument()
    })
    expect(play).not.toHaveBeenCalled()
  })
})
