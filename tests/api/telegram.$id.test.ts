import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/services/log', () => ({
  getLog: vi.fn(),
}))

vi.mock('@/services/notification', () => ({
  sendEventNotification: vi.fn(),
}))

import { getLog } from '@/services/log'
import { sendEventNotification } from '@/services/notification'
import { Route } from '@/start/routes/api/telegram/$id'

const POST = Route.options.server?.handlers?.POST as (ctx: {
  params: { id: string }
}) => Promise<Response>

const callPost = (id: string) => POST({ params: { id } })

describe('POST /api/telegram/$id', () => {
  beforeEach(() => {
    vi.mocked(getLog).mockReset()
    vi.mocked(sendEventNotification).mockReset()
  })

  it('rejects a non-numeric id', async () => {
    const res = await callPost('abc')
    expect(await res.json()).toEqual({ success: false, error: 'Invalid event ID' })
    expect(getLog).not.toHaveBeenCalled()
  })

  it('returns "Event not found" when the log is missing', async () => {
    vi.mocked(getLog).mockResolvedValueOnce(null)
    const res = await callPost('7')
    expect(await res.json()).toEqual({ success: false, error: 'Event not found' })
    expect(sendEventNotification).not.toHaveBeenCalled()
  })

  it('forwards the notification error when sending fails', async () => {
    vi.mocked(getLog).mockResolvedValueOnce({ id: 7 } as never)
    vi.mocked(sendEventNotification).mockResolvedValueOnce({
      success: false,
      error: 'no chat ids',
    })
    const res = await callPost('7')
    expect(await res.json()).toEqual({ success: false, error: 'no chat ids' })
  })

  it('returns the message id on success', async () => {
    vi.mocked(getLog).mockResolvedValueOnce({ id: 7 } as never)
    vi.mocked(sendEventNotification).mockResolvedValueOnce({
      success: true,
      messageId: 42,
    })
    const res = await callPost('7')
    expect(await res.json()).toEqual({ success: true, messageId: 42 })
  })

  it('returns the catch-all error when the service throws', async () => {
    vi.mocked(getLog).mockRejectedValueOnce(new Error('db down'))
    const res = await callPost('7')
    expect(await res.json()).toEqual({ success: false, error: 'db down' })
  })
})
