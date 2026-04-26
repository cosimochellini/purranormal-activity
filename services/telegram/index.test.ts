import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mockFetchOnce, mockFetchReject } from '@/tests/helpers'
import { logger } from '@/utils/logger'
import { sendMessage, sendPhoto } from './index'

const fetchMock = () => globalThis.fetch as unknown as ReturnType<typeof vi.fn>

const lastFetchCall = () => {
  const calls = fetchMock().mock.calls
  expect(calls.length).toBeGreaterThan(0)
  return calls[calls.length - 1] as [string, RequestInit]
}

const lastBody = () => {
  const [, init] = lastFetchCall()
  return JSON.parse(init.body as string)
}

beforeEach(() => {
  fetchMock().mockReset()
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('sendMessage', () => {
  it('returns success and messageId when Telegram API answers ok:true', async () => {
    mockFetchOnce({ ok: true, result: { message_id: 42 } })

    const result = await sendMessage('123', 'hello')

    expect(result).toEqual({ success: true, messageId: 42 })
    const body = lastBody()
    expect(body).toMatchObject({
      chat_id: '123',
      text: 'hello',
      parse_mode: 'HTML',
      disable_web_page_preview: true,
      disable_notification: false,
    })
  })

  it('returns failure with the API description when Telegram answers ok:false', async () => {
    mockFetchOnce({ ok: false, description: 'chat not found' })

    const result = await sendMessage('123', 'hi')

    expect(result).toEqual({ success: false, error: 'chat not found' })
    expect(vi.mocked(logger.error)).toHaveBeenCalledWith(
      'Telegram API error for chat 123:',
      'chat not found',
    )
  })

  it('returns a generic error when Telegram answers ok:false without description', async () => {
    mockFetchOnce({ ok: false })

    const result = await sendMessage('123', 'hi')

    expect(result).toEqual({ success: false, error: 'Telegram API rejected the message' })
  })

  it('returns failure when fetch rejects (network error)', async () => {
    mockFetchReject(new Error('network down'))

    const result = await sendMessage('123', 'hi')

    expect(result).toEqual({ success: false, error: 'network down' })
    expect(vi.mocked(logger.error)).toHaveBeenCalledWith(
      'Telegram sendMessage failed for chat 123:',
      expect.any(Error),
    )
  })

  it('falls back to "Unknown error" when a non-Error value is thrown', async () => {
    fetchMock().mockRejectedValueOnce('string-throw')

    const result = await sendMessage('123', 'hi')

    expect(result).toEqual({ success: false, error: 'Unknown error' })
  })

  it('trims whitespace from chatId before posting', async () => {
    mockFetchOnce({ ok: true, result: { message_id: 1 } })

    await sendMessage('   555  ', 'hi')

    expect(lastBody()).toMatchObject({ chat_id: '555' })
  })

  it('honours a caller-supplied parseMode override', async () => {
    mockFetchOnce({ ok: true, result: { message_id: 1 } })

    await sendMessage('123', 'hi', { parseMode: 'MarkdownV2', silent: true })

    expect(lastBody()).toMatchObject({
      parse_mode: 'MarkdownV2',
      disable_notification: true,
    })
  })
})

describe('sendPhoto', () => {
  it('returns success with messageId on Telegram ok:true', async () => {
    mockFetchOnce({ ok: true, result: { message_id: 99 } })

    const result = await sendPhoto('123', 'https://images.example.test/1.webp')

    expect(result).toEqual({ success: true, messageId: 99 })
  })

  it('defaults parse_mode to MarkdownV2 (preserves the production payload)', async () => {
    mockFetchOnce({ ok: true, result: { message_id: 1 } })

    await sendPhoto('123', 'https://images.example.test/1.webp')

    expect(lastBody()).toMatchObject({
      chat_id: '123',
      photo: 'https://images.example.test/1.webp',
      parse_mode: 'MarkdownV2',
      disable_notification: false,
    })
  })

  it('returns failure with description when Telegram answers ok:false', async () => {
    mockFetchOnce({ ok: false, description: 'photo too large' })

    const result = await sendPhoto('123', 'https://images.example.test/1.webp')

    expect(result).toEqual({ success: false, error: 'photo too large' })
  })

  it('returns failure when fetch rejects', async () => {
    mockFetchReject(new Error('boom'))

    const result = await sendPhoto('123', 'https://images.example.test/1.webp')

    expect(result).toEqual({ success: false, error: 'boom' })
  })

  it('falls back to a generic photo-error string when description is absent', async () => {
    mockFetchOnce({ ok: false })

    const result = await sendPhoto('123', 'https://images.example.test/1.webp')

    expect(result).toEqual({ success: false, error: 'Telegram API rejected the photo' })
  })

  it('trims the chatId and forwards the photo URL verbatim', async () => {
    mockFetchOnce({ ok: true, result: { message_id: 1 } })

    await sendPhoto('  c1  ', 'https://images.example.test/77/cover.webp')

    expect(lastBody()).toMatchObject({
      chat_id: 'c1',
      photo: 'https://images.example.test/77/cover.webp',
    })
  })

  it('honours caller-supplied caption + parseMode override', async () => {
    mockFetchOnce({ ok: true, result: { message_id: 1 } })

    await sendPhoto('123', 'https://images.example.test/1.webp', {
      caption: 'a caption',
      parseMode: 'HTML',
      silent: true,
    })

    expect(lastBody()).toMatchObject({
      caption: 'a caption',
      parse_mode: 'HTML',
      disable_notification: true,
    })
  })
})
