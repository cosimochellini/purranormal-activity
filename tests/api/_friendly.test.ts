import { describe, expect, it, vi } from 'vitest'
import {
  createFriendly,
  type FriendlyMessages,
  friendlyCopy,
} from '@/start/routes/api/log/_friendly'

const baseMessages: FriendlyMessages = {
  AI_UNAVAILABLE: 'AI_UNAVAILABLE',
  AI_UNEXPECTED_RESPONSE: 'AI_UNEXPECTED_RESPONSE',
  CONNECTION_ISSUE: 'CONNECTION_ISSUE',
  REQUEST_TIMEOUT: 'REQUEST_TIMEOUT',
  GENERIC_FALLBACK: 'GENERIC_FALLBACK',
  DB_UNAVAILABLE: 'DB_UNAVAILABLE',
}

const messagesNoDb: FriendlyMessages = {
  AI_UNAVAILABLE: 'AI_UNAVAILABLE',
  AI_UNEXPECTED_RESPONSE: 'AI_UNEXPECTED_RESPONSE',
  CONNECTION_ISSUE: 'CONNECTION_ISSUE',
  REQUEST_TIMEOUT: 'REQUEST_TIMEOUT',
  GENERIC_FALLBACK: 'GENERIC_FALLBACK',
}

describe('friendlyCopy(messages)', () => {
  describe('fromAiResult', () => {
    const copy = friendlyCopy(baseMessages)

    it('maps "parse" to AI_UNEXPECTED_RESPONSE regardless of message', () => {
      expect(copy.fromAiResult('parse', 'anything goes')).toBe('AI_UNEXPECTED_RESPONSE')
      expect(copy.fromAiResult('parse', '')).toBe('AI_UNEXPECTED_RESPONSE')
    })

    it('maps "validation" to AI_UNEXPECTED_RESPONSE regardless of message', () => {
      expect(copy.fromAiResult('validation', 'whatever')).toBe('AI_UNEXPECTED_RESPONSE')
    })

    it('maps "model" with libsql tokens to DB_UNAVAILABLE (DB-first ordering)', () => {
      expect(copy.fromAiResult('model', 'libsql: connection refused')).toBe('DB_UNAVAILABLE')
    })

    it('maps "model" with sqlite/turso/drizzle tokens to DB_UNAVAILABLE', () => {
      expect(copy.fromAiResult('model', 'sqlite: disk error')).toBe('DB_UNAVAILABLE')
      expect(copy.fromAiResult('model', 'turso replica unreachable')).toBe('DB_UNAVAILABLE')
      expect(copy.fromAiResult('model', 'drizzle migration failed')).toBe('DB_UNAVAILABLE')
    })

    it('falls back to GENERIC_FALLBACK on DB error when DB_UNAVAILABLE is omitted', () => {
      const copyNoDb = friendlyCopy(messagesNoDb)
      expect(copyNoDb.fromAiResult('model', 'libsql: connection refused')).toBe('GENERIC_FALLBACK')
    })

    it('maps timeout messages to REQUEST_TIMEOUT', () => {
      expect(copy.fromAiResult('model', 'request timeout after 30s')).toBe('REQUEST_TIMEOUT')
    })

    it('maps network/fetch messages to CONNECTION_ISSUE when no AI tokens', () => {
      expect(copy.fromAiResult('model', 'network unreachable')).toBe('CONNECTION_ISSUE')
      expect(copy.fromAiResult('model', 'fetch failed')).toBe('CONNECTION_ISSUE')
    })

    it('maps "model" with OpenAI tokens to AI_UNAVAILABLE (DB ordering does not pre-empt fallback when no DB tokens present)', () => {
      expect(copy.fromAiResult('model', 'OpenAI API error: 503')).toBe('AI_UNAVAILABLE')
    })

    it('falls back to AI_UNAVAILABLE for "model" with no recognised tokens', () => {
      expect(copy.fromAiResult('model', 'something opaque went wrong')).toBe('AI_UNAVAILABLE')
    })

    it('does NOT false-match harmless narrative containing the word "database"', () => {
      const out = copy.fromAiResult('model', 'User database of paranormal events is empty')
      expect(out).not.toBe('DB_UNAVAILABLE')
      expect(out).toBe('AI_UNAVAILABLE')
    })
  })

  describe('fromThrown', () => {
    const copy = friendlyCopy(baseMessages)

    it('maps a bare Error("fetch failed") to CONNECTION_ISSUE (no OpenAI name → infra wins)', () => {
      expect(copy.fromThrown(new Error('fetch failed'))).toBe('CONNECTION_ISSUE')
    })

    it('maps an OpenAIError-named "fetch failed" to AI_UNAVAILABLE (name enrichment beats infra)', () => {
      const err = Object.assign(new Error('fetch failed'), { name: 'OpenAIError' })
      expect(copy.fromThrown(err)).toBe('AI_UNAVAILABLE')
    })

    it('maps Error mentioning rate limit to AI_UNAVAILABLE', () => {
      expect(copy.fromThrown(new Error('rate limit exceeded'))).toBe('AI_UNAVAILABLE')
    })

    it('maps Error with libsql tokens to DB_UNAVAILABLE (AI-first ordering does not match)', () => {
      expect(copy.fromThrown(new Error('libsql: connection refused'))).toBe('DB_UNAVAILABLE')
    })

    it('maps timeout-only Error to REQUEST_TIMEOUT', () => {
      expect(copy.fromThrown(new Error('request timeout'))).toBe('REQUEST_TIMEOUT')
    })

    it('maps a plain string to GENERIC_FALLBACK', () => {
      expect(copy.fromThrown('plain string')).toBe('GENERIC_FALLBACK')
    })

    it('handles null without crashing', () => {
      expect(copy.fromThrown(null)).toBe('GENERIC_FALLBACK')
    })

    it('handles undefined without crashing', () => {
      expect(copy.fromThrown(undefined)).toBe('GENERIC_FALLBACK')
    })

    it('handles non-Error objects without crashing', () => {
      expect(copy.fromThrown({ weird: true })).toBe('GENERIC_FALLBACK')
    })
  })
})

describe('createFriendly(cfg)', () => {
  const buildResponse = (text: string) => ({ success: false as const, text })

  it('guard returns happy-path response unchanged and does not call onError', async () => {
    const onError = vi.fn()
    const friendly = createFriendly({
      messages: baseMessages,
      build: buildResponse,
      onError,
    })

    const happy = { success: true as const, value: 42 }
    // biome-ignore lint/suspicious/noExplicitAny: union shape for test only
    const result = await friendly.guard(async () => happy as any)

    expect(result).toBe(happy)
    expect(onError).not.toHaveBeenCalled()
  })

  it('guard catches throws, returns built error response, and calls onError exactly once', async () => {
    const onError = vi.fn()
    const friendly = createFriendly({
      messages: baseMessages,
      build: buildResponse,
      onError,
    })

    const error = new Error('boom')
    const result = await friendly.guard(async () => {
      throw error
    })

    expect(result).toEqual({ success: false, text: 'GENERIC_FALLBACK' })
    expect(onError).toHaveBeenCalledTimes(1)
    expect(onError).toHaveBeenCalledWith(error, 'GENERIC_FALLBACK')
  })

  it('guard works without onError defined', async () => {
    const friendly = createFriendly({ messages: baseMessages, build: buildResponse })
    const result = await friendly.guard(async () => {
      throw new Error('boom')
    })
    expect(result).toEqual({ success: false, text: 'GENERIC_FALLBACK' })
  })

  it('fromAi unwraps ok result and does not call onError', () => {
    const onError = vi.fn()
    const friendly = createFriendly({
      messages: baseMessages,
      build: buildResponse,
      onError,
    })

    const result = friendly.fromAi({ ok: true, value: 'x' })
    expect(result).toEqual({ ok: true, value: 'x' })
    expect(onError).not.toHaveBeenCalled()
  })

  it('fromAi returns built error response on !ok and calls onError once with the envelope', () => {
    const onError = vi.fn()
    const friendly = createFriendly({
      messages: baseMessages,
      build: buildResponse,
      onError,
    })

    const envelope = { ok: false as const, error: 'parse' as const, message: 'bad json' }
    const result = friendly.fromAi(envelope)

    expect(result).toEqual({
      ok: false,
      response: { success: false, text: 'AI_UNEXPECTED_RESPONSE' },
    })
    expect(onError).toHaveBeenCalledTimes(1)
    expect(onError).toHaveBeenCalledWith(envelope, 'AI_UNEXPECTED_RESPONSE')
  })

  it('fromAi works without onError defined', () => {
    const friendly = createFriendly({ messages: baseMessages, build: buildResponse })
    const result = friendly.fromAi({ ok: false, error: 'parse', message: 'bad' })
    expect(result).toEqual({
      ok: false,
      response: { success: false, text: 'AI_UNEXPECTED_RESPONSE' },
    })
  })

  it('fromThrow synchronously classifies and calls onError', () => {
    const onError = vi.fn()
    const friendly = createFriendly({
      messages: baseMessages,
      build: buildResponse,
      onError,
    })

    const result = friendly.fromThrow(new Error('rate limit hit'))
    expect(result).toEqual({ success: false, text: 'AI_UNAVAILABLE' })
    expect(onError).toHaveBeenCalledTimes(1)
  })
})
