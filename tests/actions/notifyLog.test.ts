import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/drizzle', () => ({ db: {} }))
vi.mock('@/services/imagePipeline', () => ({ imagePipeline: {} }))
vi.mock('@/services/imageStore/r2.server', () => ({ imageStore: {} }))
vi.mock('@/services/storyForge', () => ({ storyForge: {} }))

vi.mock('@/services/log', () => ({
  getLog: vi.fn(),
  getLogs: vi.fn(),
}))

vi.mock('@/services/notifier', () => ({
  notifier: { notify: vi.fn() },
}))

import { getLog } from '@/services/log'
import { notifyLog } from '@/services/logActions.server'
import { notifier } from '@/services/notifier'

const mockEvent = (id: number) => ({ id }) as never

describe('notifyLog', () => {
  beforeEach(() => {
    vi.mocked(getLog).mockReset()
    vi.mocked(notifier.notify).mockReset()
  })

  it.each([
    ['NaN', Number.NaN],
    ['zero', 0],
    ['a negative id', -4],
    ['a fractional id', 2.5],
  ])('rejects %s', async (_label, id) => {
    expect(await notifyLog(id)).toEqual({ success: false, error: 'Invalid event ID' })
    expect(getLog).not.toHaveBeenCalled()
    expect(notifier.notify).not.toHaveBeenCalled()
  })

  it('returns "Event not found" when the log is missing', async () => {
    vi.mocked(getLog).mockResolvedValueOnce(null)

    expect(await notifyLog(7)).toEqual({ success: false, error: 'Event not found' })
    expect(getLog).toHaveBeenCalledWith(7)
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

    expect(await notifyLog(7)).toEqual({ success: true, messageId: 42 })
    expect(notifier.notify).toHaveBeenCalledWith({ id: 7 })
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

    expect(await notifyLog(7)).toEqual({ success: true, messageId: 0 })
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

    expect(await notifyLog(7)).toEqual({
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

    expect(await notifyLog(7)).toEqual({
      success: false,
      error: 'Telegram fan-out failed',
      partial: { reachedChats: 0, totalChats: 2, failedPhotoChats: [] },
    })
  })

  it('forwards a thrown Error.message verbatim (no friendly-copy rewrite)', async () => {
    // The friendly classifier would normally rewrite libsql tokens into a
    // static string. This action opts out so the raw cause survives.
    vi.mocked(getLog).mockRejectedValueOnce(new Error('libsql: connection lost'))

    expect(await notifyLog(7)).toEqual({ success: false, error: 'libsql: connection lost' })
  })

  it('forwards a notifier throw the same way', async () => {
    vi.mocked(getLog).mockResolvedValueOnce(mockEvent(7))
    vi.mocked(notifier.notify).mockRejectedValueOnce(new Error('telegram 502'))

    expect(await notifyLog(7)).toEqual({ success: false, error: 'telegram 502' })
  })

  it('falls back to `Unknown error` when a non-Error value is thrown', async () => {
    vi.mocked(getLog).mockRejectedValueOnce('explosion' as never)

    expect(await notifyLog(7)).toEqual({ success: false, error: 'Unknown error' })
  })
})
