import { beforeEach, describe, expect, it, vi } from 'vitest'
import { logger } from '@/utils/logger'
import type { makeFakeDb } from '../tests/helpers'

vi.mock('@/drizzle', async () => {
  const { makeFakeDb: make } = await import('../tests/helpers')
  return { db: make() }
})

vi.mock('@/services/imagePipeline', () => ({
  imagePipeline: {
    run: vi.fn(),
  },
}))

vi.mock('@/services/telegram', () => ({
  sendMessage: vi.fn(async () => ({ success: true })),
}))

vi.mock('@/env/telegram', () => ({
  TELEGRAM_BOT_API_KEY: 'test-key',
  TELEGRAM_BOT_CHAT_IDS: ['chat-1', 'chat-2'],
}))

vi.mock('@/utils/promise', () => ({
  wait: vi.fn(async () => undefined),
}))

import { imagePipeline } from '@/services/imagePipeline'
import { runImageGenerationScript } from '@/services/script'
import { sendMessage } from '@/services/telegram'
import { wait } from '@/utils/promise'

const { db: fakeDb } = (await import('@/drizzle')) as unknown as {
  db: ReturnType<typeof makeFakeDb>
}

describe('runImageGenerationScript', () => {
  beforeEach(() => {
    fakeDb.__reset()
    vi.mocked(imagePipeline.run).mockReset()
    vi.mocked(imagePipeline.run).mockImplementation(async (id: number) => ({
      kind: 'success',
      logId: id,
    }))
    vi.mocked(sendMessage).mockReset()
    vi.mocked(sendMessage).mockImplementation(async () => ({ success: true }))
    vi.mocked(wait).mockReset()
    vi.mocked(wait).mockImplementation(async () => undefined)
    vi.mocked(logger.error).mockClear()
    vi.mocked(logger.warn).mockClear()
  })

  it('returns processed:0 when no logs are pending', async () => {
    vi.mocked(fakeDb.where).mockReturnValueOnce([] as never)

    const result = await runImageGenerationScript()
    expect(result).toEqual({ success: true, processed: 0 })
    expect(imagePipeline.run).not.toHaveBeenCalled()
  })

  it('processes pending logs in batches of 5 with a delay between batches', async () => {
    const logs = Array.from({ length: 12 }, (_, i) => ({ id: i + 1 }))
    vi.mocked(fakeDb.where).mockReturnValueOnce(logs as never)

    const result = await runImageGenerationScript()
    expect(result).toEqual({ success: true, processed: 12 })
    expect(imagePipeline.run).toHaveBeenCalledTimes(12)
    expect(wait).toHaveBeenCalledTimes(3)
    expect(wait).toHaveBeenCalledWith(5000)
    expect(sendMessage).not.toHaveBeenCalled()
  })

  it('logs a warning on skipped outcomes and keeps going', async () => {
    const logs = [{ id: 1 }, { id: 2 }, { id: 3 }]
    vi.mocked(fakeDb.where).mockReturnValueOnce(logs as never)
    vi.mocked(imagePipeline.run).mockImplementationOnce(async () => ({
      kind: 'skipped',
      logId: 1,
      reason: 'not-pending',
    }))

    const result = await runImageGenerationScript()
    expect(result).toEqual({ success: true, processed: 3 })
    expect(imagePipeline.run).toHaveBeenCalledTimes(3)
    expect(vi.mocked(logger.warn)).toHaveBeenCalledWith('Skipped log 1: not-pending')
    expect(sendMessage).not.toHaveBeenCalled()
  })

  it('logs an error on failed-recorded but does NOT fan out a Telegram alert', async () => {
    const logs = [{ id: 1 }, { id: 2 }]
    vi.mocked(fakeDb.where).mockReturnValueOnce(logs as never)
    vi.mocked(imagePipeline.run).mockImplementationOnce(async () => ({
      kind: 'failed-recorded',
      logId: 1,
      cause: new Error('AI down'),
    }))

    const result = await runImageGenerationScript()
    expect(result).toEqual({ success: true, processed: 2 })
    expect(vi.mocked(logger.error)).toHaveBeenCalledWith(
      'Image pipeline recorded an error for log 1',
      expect.objectContaining({ cause: expect.any(Error) }),
    )
    expect(sendMessage).not.toHaveBeenCalled()
  })

  it('fans out a Telegram alert on failed-write-also-failed for every configured chat', async () => {
    const logs = [{ id: 1 }, { id: 2 }]
    vi.mocked(fakeDb.where).mockReturnValueOnce(logs as never)
    const cause = new Error('AI down')
    const writeError = new Error('db down')
    vi.mocked(imagePipeline.run).mockImplementationOnce(async () => ({
      kind: 'failed-write-also-failed',
      logId: 1,
      cause,
      writeError,
    }))

    const result = await runImageGenerationScript()
    expect(result).toEqual({ success: true, processed: 2 })
    expect(sendMessage).toHaveBeenCalledTimes(2)
    expect(sendMessage).toHaveBeenCalledWith('chat-1', expect.stringContaining('logId: 1'))
    expect(sendMessage).toHaveBeenCalledWith(
      'chat-2',
      expect.stringContaining('writeError: db down'),
    )
  })

  it('keeps the batch alive when a per-chat Telegram send throws', async () => {
    const logs = [{ id: 1 }]
    vi.mocked(fakeDb.where).mockReturnValueOnce(logs as never)
    vi.mocked(imagePipeline.run).mockImplementationOnce(async () => ({
      kind: 'failed-write-also-failed',
      logId: 1,
      cause: new Error('AI down'),
      writeError: new Error('db down'),
    }))
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
    const logs = [{ id: 1 }]
    vi.mocked(fakeDb.where).mockReturnValueOnce(logs as never)
    vi.mocked(imagePipeline.run).mockImplementationOnce(async () => ({
      kind: 'failed-write-also-failed',
      logId: 1,
      cause: new Error('AI down'),
      writeError: new Error('db down'),
    }))
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

  it('returns success:false when the initial DB select throws', async () => {
    vi.mocked(fakeDb.where).mockImplementationOnce(() => {
      throw new Error('db down')
    })

    const result = await runImageGenerationScript()
    expect(result).toEqual({
      success: false,
      processed: 0,
      error: 'Failed to process logs',
    })
    expect(imagePipeline.run).not.toHaveBeenCalled()
  })
})
