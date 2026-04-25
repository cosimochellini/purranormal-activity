import { beforeEach, describe, expect, it, vi } from 'vitest'
import { LogStatus } from '@/data/enum/logStatus'
import type { LogWithCategories } from '@/db/schema'
import { logger } from '@/utils/logger'

const { generateTelegramMessage, sendMessage, sendPhoto } = vi.hoisted(() => ({
  generateTelegramMessage: vi.fn(async () => 'mock message'),
  sendMessage: vi.fn(async () => ({ success: true, messageIds: [1] })),
  sendPhoto: vi.fn(async () => ({ success: true, messageIds: [2] })),
}))

vi.mock('@/services/ai', () => ({
  generateTelegramMessage,
}))

vi.mock('@/services/telegram', () => ({
  sendMessage,
  sendPhoto,
}))

import { sendEventNotification } from './notification'

const event: LogWithCategories = {
  id: 5,
  title: 'Spooky',
  description: 'desc',
  createdAt: 1,
  updatedAt: 2,
  status: LogStatus.ImageGenerated,
  error: null,
  imageDescription: 'img',
  categories: [1, 2],
}

beforeEach(() => {
  vi.clearAllMocks()
  generateTelegramMessage.mockResolvedValue('mock message')
  sendMessage.mockResolvedValue({ success: true, messageIds: [11] })
  sendPhoto.mockResolvedValue({ success: true, messageIds: [22] })
})

describe('sendEventNotification', () => {
  it('returns success with the last messageId on the happy path', async () => {
    sendMessage.mockResolvedValueOnce({ success: true, messageIds: [11, 12] })
    sendPhoto.mockResolvedValueOnce({ success: true, messageIds: [21, 22] })

    const result = await sendEventNotification(event)
    expect(result).toEqual({ success: true, messageId: 12 })
    expect(generateTelegramMessage).toHaveBeenCalledWith(event)
    expect(sendMessage).toHaveBeenCalledWith({
      text: 'mock message',
      options: { parseMode: 'HTML' },
    })
    expect(sendPhoto).toHaveBeenCalledWith({
      photo: 'https://pub-9cd2e6644bc8418a87242879f6146869.r2.dev/5/cover.webp',
      options: { parseMode: 'MarkdownV2' },
    })
  })

  it('returns the message error when sendMessage fails (and skips sendPhoto)', async () => {
    sendMessage.mockResolvedValueOnce({ success: false, error: 'msg-broken' })

    const result = await sendEventNotification(event)
    expect(result).toEqual({ success: false, error: 'msg-broken' })
    expect(sendPhoto).not.toHaveBeenCalled()
    expect(vi.mocked(logger.error)).toHaveBeenCalledWith(
      'Failed to send message:',
      expect.objectContaining({ error: 'msg-broken', eventId: 5 }),
    )
  })

  it('falls back to a generic message-error string when sendMessage returns no error', async () => {
    sendMessage.mockResolvedValueOnce({ success: false })

    const result = await sendEventNotification(event)
    expect(result).toEqual({ success: false, error: 'Failed to send message' })
  })

  // Bug #2 regression: when sendMessage succeeds but sendPhoto fails, the
  // returned error MUST be the photoResult.error — not the success message
  // result error. The original bug used `result.error` here; now it must be
  // `photoResult.error`.
  it('returns the PHOTO error (not the message-success error) when sendPhoto fails (Bug #2)', async () => {
    sendMessage.mockResolvedValueOnce({ success: true, messageIds: [1] })
    sendPhoto.mockResolvedValueOnce({ success: false, error: 'photo-broken' })

    const result = await sendEventNotification(event)
    expect(result).toEqual({ success: false, error: 'photo-broken' })
    // Specifically: not the (undefined) message error.
    expect(result.error).not.toBeUndefined()
    expect(result.error).toBe('photo-broken')
  })

  it('falls back to a generic photo-error string when sendPhoto returns no error', async () => {
    sendMessage.mockResolvedValueOnce({ success: true, messageIds: [1] })
    sendPhoto.mockResolvedValueOnce({ success: false })

    const result = await sendEventNotification(event)
    expect(result).toEqual({ success: false, error: 'Failed to send photo' })
  })

  it('returns success with messageId=0 when messageIds is missing on success', async () => {
    sendMessage.mockResolvedValueOnce({ success: true })
    sendPhoto.mockResolvedValueOnce({ success: true, messageIds: [99] })

    const result = await sendEventNotification(event)
    expect(result).toEqual({ success: true, messageId: 0 })
  })

  it('returns failure with the thrown error message when generateTelegramMessage throws', async () => {
    generateTelegramMessage.mockRejectedValueOnce(new Error('llm down'))
    const result = await sendEventNotification(event)
    expect(result).toEqual({ success: false, error: 'llm down' })
    expect(vi.mocked(logger.error)).toHaveBeenCalledWith(
      'Failed to format event notification:',
      expect.any(Error),
    )
  })

  it('returns "Unknown error" when a non-Error is thrown', async () => {
    generateTelegramMessage.mockRejectedValueOnce('string-throw')
    const result = await sendEventNotification(event)
    expect(result).toEqual({ success: false, error: 'Unknown error' })
  })
})
