import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PipelineOutcome } from '@/services/imagePipeline'
import { logger } from '@/utils/logger'

vi.mock('@/services/imagePipeline', () => ({
  imagePipeline: {
    drainOnePending: vi.fn(),
  },
}))

vi.mock('@/services/telegram', () => ({
  sendMessage: vi.fn(async () => ({ success: true })),
}))

vi.mock('@/env/telegram', () => ({
  TELEGRAM_BOT_API_KEY: 'test-key',
  TELEGRAM_BOT_CHAT_IDS: ['chat-1', 'chat-2'],
}))

import { imagePipeline } from '@/services/imagePipeline'
import { runImageGenerationScript } from '@/services/script'
import { sendMessage } from '@/services/telegram'

const queueOutcomes = (...outcomes: Array<PipelineOutcome | null>) => {
  const drain = vi.mocked(imagePipeline.drainOnePending)
  drain.mockReset()
  for (const outcome of outcomes) {
    drain.mockResolvedValueOnce(outcome)
  }
  // Anything beyond the queued list returns null (queue empty).
  drain.mockResolvedValue(null)
}

describe('runImageGenerationScript', () => {
  beforeEach(() => {
    vi.mocked(imagePipeline.drainOnePending).mockReset()
    vi.mocked(sendMessage).mockReset()
    vi.mocked(sendMessage).mockImplementation(async () => ({ success: true }))
    vi.mocked(logger.error).mockClear()
    vi.mocked(logger.warn).mockClear()
  })

  it('returns processed:0 when the queue is empty on the first call', async () => {
    queueOutcomes()

    const result = await runImageGenerationScript()
    expect(result).toEqual({ success: true, processed: 0 })
    expect(imagePipeline.drainOnePending).toHaveBeenCalledTimes(1)
  })

  it('drains the queue sequentially and returns processed = number of non-null outcomes', async () => {
    queueOutcomes(
      { kind: 'success', logId: 1 },
      { kind: 'success', logId: 2 },
      { kind: 'success', logId: 3 },
    )

    const result = await runImageGenerationScript()
    expect(result).toEqual({ success: true, processed: 3 })
    // Three outcomes + one final null = four calls.
    expect(imagePipeline.drainOnePending).toHaveBeenCalledTimes(4)
    expect(sendMessage).not.toHaveBeenCalled()
  })

  it('logs a warning on skipped outcomes and keeps draining', async () => {
    queueOutcomes(
      { kind: 'skipped', logId: 1, reason: 'not-pending' },
      { kind: 'success', logId: 2 },
    )

    const result = await runImageGenerationScript()
    expect(result).toEqual({ success: true, processed: 2 })
    expect(vi.mocked(logger.warn)).toHaveBeenCalledWith('Skipped log 1: not-pending')
    expect(sendMessage).not.toHaveBeenCalled()
  })

  it('logs an error on failed-recorded but does NOT fan out a Telegram alert', async () => {
    queueOutcomes({
      kind: 'failed-recorded',
      logId: 1,
      cause: new Error('AI down'),
    })

    const result = await runImageGenerationScript()
    expect(result).toEqual({ success: true, processed: 1 })
    expect(vi.mocked(logger.error)).toHaveBeenCalledWith(
      'Image pipeline recorded an error for log 1',
      expect.objectContaining({ cause: expect.any(Error) }),
    )
    expect(sendMessage).not.toHaveBeenCalled()
  })

  it('fans out a Telegram alert on failed-write-also-failed for every configured chat', async () => {
    const cause = new Error('AI down')
    const writeError = new Error('db down')
    queueOutcomes({
      kind: 'failed-write-also-failed',
      logId: 1,
      cause,
      writeError,
    })

    const result = await runImageGenerationScript()
    expect(result).toEqual({ success: true, processed: 1 })
    expect(sendMessage).toHaveBeenCalledTimes(2)
    expect(sendMessage).toHaveBeenCalledWith('chat-1', expect.stringContaining('logId: 1'))
    expect(sendMessage).toHaveBeenCalledWith(
      'chat-2',
      expect.stringContaining('writeError: db down'),
    )
  })

  it('HTML-escapes <, >, & in the alert text so Telegram (parseMode HTML) does not reject it', async () => {
    queueOutcomes({
      kind: 'failed-write-also-failed',
      logId: 9,
      cause: new Error('Cannot read <undefined> & friends'),
      writeError: new Error('SQL: SELECT > FROM bad'),
    })

    await runImageGenerationScript()

    const calls = vi.mocked(sendMessage).mock.calls
    expect(calls.length).toBeGreaterThan(0)
    const text = calls[0][1] as string
    expect(text).toContain('&lt;undefined&gt;')
    expect(text).toContain('&amp; friends')
    expect(text).toContain('SELECT &gt; FROM bad')
    expect(text).not.toContain('<undefined>')
    expect(text).not.toMatch(/[^&]& /)
  })

  it('keeps draining when a per-chat Telegram send throws', async () => {
    queueOutcomes({
      kind: 'failed-write-also-failed',
      logId: 1,
      cause: new Error('AI down'),
      writeError: new Error('db down'),
    })
    vi.mocked(sendMessage)
      .mockImplementationOnce(async () => {
        throw new Error('telegram threw')
      })
      .mockImplementationOnce(async () => ({ success: true }))

    const result = await runImageGenerationScript()
    expect(result).toEqual({ success: true, processed: 1 })
    expect(vi.mocked(logger.error)).toHaveBeenCalledWith(
      'Pipeline alert: Telegram threw while sending',
      expect.objectContaining({ chatId: 'chat-1', logId: 1 }),
    )
  })

  it('logs when Telegram returns success:false (per-chat rejection)', async () => {
    queueOutcomes({
      kind: 'failed-write-also-failed',
      logId: 1,
      cause: new Error('AI down'),
      writeError: new Error('db down'),
    })
    vi.mocked(sendMessage).mockImplementation(async () => ({
      success: false,
      error: 'chat blocked the bot',
    }))

    const result = await runImageGenerationScript()
    expect(result).toEqual({ success: true, processed: 1 })
    expect(vi.mocked(logger.error)).toHaveBeenCalledWith(
      'Pipeline alert: Telegram rejected the message',
      expect.objectContaining({ chatId: expect.any(String), error: 'chat blocked the bot' }),
    )
  })

  it('returns success:false when drainOnePending throws', async () => {
    vi.mocked(imagePipeline.drainOnePending).mockReset()
    vi.mocked(imagePipeline.drainOnePending).mockRejectedValueOnce(new Error('db down'))

    const result = await runImageGenerationScript()
    expect(result).toEqual({
      success: false,
      processed: 0,
      error: 'Failed to process logs',
    })
  })
})
