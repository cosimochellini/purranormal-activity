import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LogStatus } from '@/data/enum/logStatus'
import type { LogWithCategories } from '@/db/schema'
import type { ChatResult } from '@/services/telegram/types'
import { logger } from '@/utils/logger'

// Boundary mocks so the default singleton's lazy deps never trigger
// real module loads (which would pull drizzle/openai env reads).
vi.mock('@/services/ai', () => ({
  generateTelegramMessage: vi.fn(async () => 'default text'),
}))
vi.mock('@/services/telegram', () => ({
  sendMessage: vi.fn(async () => ({ success: true, messageId: 1 })),
  sendPhoto: vi.fn(async () => ({ success: true, messageId: 2 })),
}))
vi.mock('@/utils/public-image', () => ({
  publicImage: vi.fn((id: number) => `https://images.test/${id}/cover.webp`),
}))
vi.mock('@/env/telegram', () => ({
  TELEGRAM_BOT_API_KEY: 'test-key',
  TELEGRAM_BOT_CHAT_IDS: ['env-c1', 'env-c2'],
}))

import { createNotifier, type NotifierDeps } from './index'

const event: LogWithCategories = {
  id: 7,
  title: 'Spooky',
  description: 'desc',
  createdAt: 1,
  updatedAt: 2,
  status: LogStatus.ImageGenerated,
  error: null,
  imageDescription: 'img',
  categories: [1, 2],
}

const ok = (messageId: number): ChatResult => ({ success: true, messageId })
const fail = (error: string): ChatResult => ({ success: false, error })

const buildDeps = (overrides: Partial<NotifierDeps> = {}): NotifierDeps => ({
  chatIds: ['c1', 'c2'],
  sendMessage: vi.fn(async () => ok(101)),
  sendPhoto: vi.fn(async () => ok(202)),
  composeMessage: vi.fn(async () => 'composed text'),
  resolveImageUrl: vi.fn((id: number) => `https://images.example.test/${id}/cover.webp`),
  logger,
  ...overrides,
})

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('createNotifier.notify', () => {
  it('returns empty-fan-out shape and skips all I/O when chatIds is empty', async () => {
    const deps = buildDeps({ chatIds: [] })
    const notifier = createNotifier(deps)

    const outcome = await notifier.notify(event)

    expect(outcome).toEqual({
      delivered: false,
      reachedChats: 0,
      totalChats: 0,
      failedPhotoChats: [],
      messageId: undefined,
    })
    expect(deps.composeMessage).not.toHaveBeenCalled()
    expect(deps.resolveImageUrl).not.toHaveBeenCalled()
    expect(deps.sendMessage).not.toHaveBeenCalled()
    expect(deps.sendPhoto).not.toHaveBeenCalled()
    expect(vi.mocked(logger.warn)).toHaveBeenCalledWith(
      'telegram fan-out skipped: no chatIds configured',
      { eventId: 7 },
    )
  })

  it('returns delivered:true when every chat receives both message and photo', async () => {
    const sendMessage = vi.fn<NotifierDeps['sendMessage']>()
    sendMessage.mockResolvedValueOnce(ok(11)).mockResolvedValueOnce(ok(12))
    const sendPhoto = vi.fn<NotifierDeps['sendPhoto']>()
    sendPhoto.mockResolvedValueOnce(ok(21)).mockResolvedValueOnce(ok(22))

    const deps = buildDeps({ sendMessage, sendPhoto })
    const outcome = await createNotifier(deps).notify(event)

    expect(outcome).toEqual({
      delivered: true,
      reachedChats: 2,
      totalChats: 2,
      failedPhotoChats: [],
      messageId: 12,
    })
    expect(sendMessage).toHaveBeenCalledTimes(2)
    expect(sendMessage).toHaveBeenNthCalledWith(1, 'c1', 'composed text')
    expect(sendMessage).toHaveBeenNthCalledWith(2, 'c2', 'composed text')
    expect(sendPhoto).toHaveBeenCalledTimes(2)
  })

  it('records failedPhotoChats when one chat receives text but photo fails', async () => {
    const sendMessage = vi.fn<NotifierDeps['sendMessage']>()
    sendMessage.mockResolvedValueOnce(ok(11)).mockResolvedValueOnce(ok(12))
    const sendPhoto = vi.fn<NotifierDeps['sendPhoto']>()
    sendPhoto.mockResolvedValueOnce(fail('photo broken')).mockResolvedValueOnce(ok(22))

    const deps = buildDeps({ sendMessage, sendPhoto })
    const outcome = await createNotifier(deps).notify(event)

    expect(outcome).toEqual({
      delivered: false,
      reachedChats: 2,
      totalChats: 2,
      failedPhotoChats: ['c1'],
      messageId: 12,
    })
    expect(sendPhoto).toHaveBeenCalledTimes(2)
    expect(vi.mocked(logger.error)).toHaveBeenCalledWith('telegram photo failed', {
      chatId: 'c1',
      error: 'photo broken',
      eventId: 7,
    })
    expect(vi.mocked(logger.warn)).toHaveBeenCalledWith(
      'telegram fan-out partial',
      expect.objectContaining({ failedPhotoChats: ['c1'], reachedChats: 2 }),
    )
  })

  it('does NOT attempt photo when text fails on a chat (text gates the photo)', async () => {
    const sendMessage = vi.fn<NotifierDeps['sendMessage']>()
    sendMessage.mockResolvedValueOnce(fail('msg-broken')).mockResolvedValueOnce(ok(12))
    const sendPhoto = vi.fn<NotifierDeps['sendPhoto']>()
    sendPhoto.mockResolvedValue(ok(22))

    const deps = buildDeps({ sendMessage, sendPhoto })
    const outcome = await createNotifier(deps).notify(event)

    expect(outcome).toEqual({
      delivered: false,
      reachedChats: 1,
      totalChats: 2,
      failedPhotoChats: [],
      messageId: 12,
    })
    // Only one photo attempt — for the chat whose text succeeded (c2).
    expect(sendPhoto).toHaveBeenCalledTimes(1)
    expect(sendPhoto).toHaveBeenCalledWith('c2', 'https://images.example.test/7/cover.webp')
  })

  it('returns reachedChats:0 and messageId:undefined when every text fails', async () => {
    const sendMessage = vi.fn<NotifierDeps['sendMessage']>(async () => fail('down'))
    const sendPhoto = vi.fn<NotifierDeps['sendPhoto']>()

    const deps = buildDeps({ sendMessage, sendPhoto })
    const outcome = await createNotifier(deps).notify(event)

    expect(outcome).toEqual({
      delivered: false,
      reachedChats: 0,
      totalChats: 2,
      failedPhotoChats: [],
      messageId: undefined,
    })
    expect(sendPhoto).not.toHaveBeenCalled()
  })

  it('isolates one chat throwing — other chats complete normally', async () => {
    const sendMessage = vi.fn<NotifierDeps['sendMessage']>()
    sendMessage
      .mockImplementationOnce(async () => {
        throw new Error('socket reset')
      })
      .mockResolvedValueOnce(ok(12))
    const sendPhoto = vi.fn<NotifierDeps['sendPhoto']>(async () => ok(22))

    const deps = buildDeps({ sendMessage, sendPhoto })
    const outcome = await createNotifier(deps).notify(event)

    expect(outcome).toEqual({
      delivered: false,
      reachedChats: 1,
      totalChats: 2,
      failedPhotoChats: [],
      messageId: 12,
    })
    expect(sendPhoto).toHaveBeenCalledTimes(1)
    expect(sendPhoto).toHaveBeenCalledWith('c2', expect.any(String))
    expect(vi.mocked(logger.error)).toHaveBeenCalledWith(
      'telegram chat threw',
      expect.objectContaining({ chatId: 'c1', eventId: 7 }),
    )
  })

  it('calls composeMessage exactly once per fan-out and resolveImageUrl with event.id', async () => {
    const composeMessage = vi.fn<NotifierDeps['composeMessage']>(async () => 'one-shot text')
    const resolveImageUrl = vi.fn<NotifierDeps['resolveImageUrl']>(
      (id) => `https://images.example.test/${id}/cover.webp`,
    )

    const deps = buildDeps({
      chatIds: ['c1', 'c2', 'c3'],
      composeMessage,
      resolveImageUrl,
    })
    await createNotifier(deps).notify(event)

    expect(composeMessage).toHaveBeenCalledTimes(1)
    expect(composeMessage).toHaveBeenCalledWith(event)
    expect(resolveImageUrl).toHaveBeenCalledTimes(1)
    expect(resolveImageUrl).toHaveBeenCalledWith(7)
  })

  it('forwards the resolveImageUrl return value to sendPhoto (no hardcoded host)', async () => {
    const sendPhoto = vi.fn<NotifierDeps['sendPhoto']>(async () => ok(22))
    const resolveImageUrl = vi.fn<NotifierDeps['resolveImageUrl']>(
      () => 'https://custom.example.test/7/cover.webp',
    )

    const deps = buildDeps({ chatIds: ['c1'], sendPhoto, resolveImageUrl })
    await createNotifier(deps).notify(event)

    expect(sendPhoto).toHaveBeenCalledWith('c1', 'https://custom.example.test/7/cover.webp')
    // Crucial regression: the legacy hardcoded R2 host MUST NOT appear.
    const calls = sendPhoto.mock.calls
    const everyUrl = calls.map(([, url]) => url).join(' ')
    expect(everyUrl).not.toContain('pub-9cd2e6644bc8418a87242879f6146869.r2.dev')
  })

  it('runs per-chat fan-out concurrently (Promise.all)', async () => {
    const order: string[] = []
    let resolveFirst: (v: ChatResult) => void = () => {}
    const firstTextPromise = new Promise<ChatResult>((res) => {
      resolveFirst = res
    })

    const sendMessage = vi.fn<NotifierDeps['sendMessage']>((chatId) => {
      order.push(`text:${chatId}`)
      if (chatId === 'c1') return firstTextPromise
      return Promise.resolve(ok(12))
    })
    const sendPhoto = vi.fn<NotifierDeps['sendPhoto']>(async (chatId) => {
      order.push(`photo:${chatId}`)
      return ok(22)
    })

    const deps = buildDeps({ sendMessage, sendPhoto })
    const promise = createNotifier(deps).notify(event)

    // Both text calls have started before the first one resolves.
    await Promise.resolve()
    expect(order).toContain('text:c1')
    expect(order).toContain('text:c2')

    // Now resolve c1's text and let the rest finish.
    resolveFirst(ok(11))
    const outcome = await promise

    expect(outcome.delivered).toBe(true)
  })
})
