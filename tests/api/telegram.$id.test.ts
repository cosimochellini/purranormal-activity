import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/services/log', () => ({
  getLog: vi.fn(),
}))

vi.mock('@/services/notifier', () => ({
  notifier: { notify: vi.fn() },
}))

import { getLog } from '@/services/log'
import { notifier } from '@/services/notifier'
import { Route } from '@/start/routes/api/telegram/$id'

const POST = Route.options.server?.handlers?.POST as (ctx: {
  params: { id: string }
}) => Promise<Response>

const callPost = (id: string) => POST({ params: { id } })

const mockEvent = (id: number) => ({ id }) as never

describe('POST /api/telegram/$id', () => {
  beforeEach(() => {
    vi.mocked(getLog).mockReset()
    vi.mocked(notifier.notify).mockReset()
  })

  it('rejects a non-numeric id', async () => {
    const res = await callPost('abc')
    expect(await res.json()).toEqual({ success: false, error: 'Invalid event ID' })
    expect(getLog).not.toHaveBeenCalled()
    expect(notifier.notify).not.toHaveBeenCalled()
  })

  it('returns "Event not found" when the log is missing', async () => {
    vi.mocked(getLog).mockResolvedValueOnce(null)
    const res = await callPost('7')
    expect(await res.json()).toEqual({ success: false, error: 'Event not found' })
    expect(notifier.notify).not.toHaveBeenCalled()
  })

  it('returns success with the notifier messageId when delivered', async () => {
    vi.mocked(getLog).mockResolvedValueOnce(mockEvent(7))
    vi.mocked(notifier.notify).mockResolvedValueOnce({
      delivered: true,
      reachedChats: 2,
      totalChats: 2,
      failedPhotoChats: [],
      messageId: 42,
    })

    const res = await callPost('7')

    expect(await res.json()).toEqual({ success: true, messageId: 42 })
  })

  it('falls back to messageId 0 when delivered but messageId is undefined', async () => {
    vi.mocked(getLog).mockResolvedValueOnce(mockEvent(7))
    vi.mocked(notifier.notify).mockResolvedValueOnce({
      delivered: true,
      reachedChats: 1,
      totalChats: 1,
      failedPhotoChats: [],
      messageId: undefined,
    })

    const res = await callPost('7')

    expect(await res.json()).toEqual({ success: true, messageId: 0 })
  })

  it('reports partial failure with the failedPhotoChats list', async () => {
    vi.mocked(getLog).mockResolvedValueOnce(mockEvent(7))
    vi.mocked(notifier.notify).mockResolvedValueOnce({
      delivered: false,
      reachedChats: 2,
      totalChats: 2,
      failedPhotoChats: ['c1'],
      messageId: 11,
    })

    const res = await callPost('7')

    expect(await res.json()).toEqual({
      success: false,
      error: 'Telegram fan-out partial',
      partial: { reachedChats: 2, totalChats: 2, failedPhotoChats: ['c1'] },
    })
  })

  it('reports total failure when no chat received the text', async () => {
    vi.mocked(getLog).mockResolvedValueOnce(mockEvent(7))
    vi.mocked(notifier.notify).mockResolvedValueOnce({
      delivered: false,
      reachedChats: 0,
      totalChats: 2,
      failedPhotoChats: [],
      messageId: undefined,
    })

    const res = await callPost('7')

    expect(await res.json()).toEqual({
      success: false,
      error: 'Telegram fan-out failed',
      partial: { reachedChats: 0, totalChats: 2, failedPhotoChats: [] },
    })
  })

  it('returns the catch-all error when the notifier throws', async () => {
    vi.mocked(getLog).mockResolvedValueOnce(mockEvent(7))
    vi.mocked(notifier.notify).mockRejectedValueOnce(new Error('llm down'))

    const res = await callPost('7')

    expect(await res.json()).toEqual({ success: false, error: 'llm down' })
  })

  it('returns the catch-all error when getLog throws', async () => {
    vi.mocked(getLog).mockRejectedValueOnce(new Error('db down'))
    const res = await callPost('7')
    expect(await res.json()).toEqual({ success: false, error: 'db down' })
  })
})
