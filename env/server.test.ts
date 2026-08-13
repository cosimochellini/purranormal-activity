/* eslint-disable node/prefer-global/process */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { logger } from '../utils/logger'
// `env/server.ts` exposes lazy getters, so a single fresh import is enough
// for every test — mutating `process.env` after the module loads must be
// reflected on the very next access.
import { serverEnv } from './server'

// Snapshot every env key the module touches, then restore in afterEach so
// the wider test suite (especially `test-setup.ts` stubs) is never perturbed.
const TRACKED_KEYS = [
  'TURSO_DATABASE_URL',
  'TURSO_AUTH_TOKEN',
  'OPENAI_API_KEY',
  'SECRET',
  'TELEGRAM_BOT_API_KEY',
  'TELEGRAM_BOT_CHAT_IDS',
  'npm_package_version',
] as const

const originals: Record<string, string | undefined> = {}

beforeEach(() => {
  for (const key of TRACKED_KEYS) {
    originals[key] = process.env[key]
    delete process.env[key]
  }
  vi.mocked(logger.warn).mockClear()
})

afterEach(() => {
  for (const key of TRACKED_KEYS) {
    const v = originals[key]
    if (v === undefined) delete process.env[key]
    else process.env[key] = v
  }
})

describe('serverEnv.required (via required getters)', () => {
  it('throws when a required env var is missing', () => {
    expect(() => serverEnv.tursoUrl).toThrow('Missing required env: TURSO_DATABASE_URL')
  })

  it('returns the value when a required env var is set', () => {
    process.env.TURSO_DATABASE_URL = 'libsql://example.turso.io'
    expect(serverEnv.tursoUrl).toBe('libsql://example.turso.io')
  })
})

describe('serverEnv.warnOptional (via telegram getters)', () => {
  it('returns the fallback empty string and logs a warn when missing', () => {
    const result = serverEnv.telegramApiKey
    expect(result).toBe('')
    expect(vi.mocked(logger.warn)).toHaveBeenCalledWith(
      expect.stringContaining('TELEGRAM_BOT_API_KEY'),
    )
  })

  it('returns the value with no warn when the optional env var is set', () => {
    process.env.TELEGRAM_BOT_API_KEY = 'bot:token'
    expect(serverEnv.telegramApiKey).toBe('bot:token')
    expect(vi.mocked(logger.warn)).not.toHaveBeenCalled()
  })
})

describe('serverEnv.telegramChatIds', () => {
  it('splits, trims, and filters empty entries', () => {
    process.env.TELEGRAM_BOT_CHAT_IDS = ' 123 , 456 ,, '
    expect(serverEnv.telegramChatIds).toEqual(['123', '456'])
  })

  it('returns [] (and warns) when unset', () => {
    expect(serverEnv.telegramChatIds).toEqual([])
    expect(vi.mocked(logger.warn)).toHaveBeenCalledWith(
      expect.stringContaining('TELEGRAM_BOT_CHAT_IDS'),
    )
  })
})

describe('lazy semantics (post-load mutation reflected)', () => {
  it('reflects a process.env mutation that happens AFTER first access', () => {
    process.env.SECRET = 'first'
    expect(serverEnv.secret).toBe('first')
    process.env.SECRET = 'second'
    expect(serverEnv.secret).toBe('second')
  })
})

describe('serverEnv.version', () => {
  it('returns the npm_package_version when set', () => {
    process.env.npm_package_version = '9.9.9'
    expect(serverEnv.version).toBe('9.9.9')
  })

  it('falls back to empty string when unset', () => {
    expect(serverEnv.version).toBe('')
  })
})

// The drizzle client is constructed by `@/drizzle` and reads `TURSO_*` env
// vars. Historically the construction was eager at module-load (the getter
// values were snapshotted inside libsql's `expandConfig`), which would crash
// the Worker on import with missing env. These tests pin the Proxy-based
// lazy contract: importing the module is safe, the env read only fires on
// first method access.
describe('@/drizzle lazy client (Workers cold-start contract)', () => {
  it('does NOT throw when TURSO_* are unset and the module is imported', async () => {
    // TRACKED_KEYS already wiped TURSO_DATABASE_URL / TURSO_AUTH_TOKEN in beforeEach.
    await expect(import('../drizzle')).resolves.toBeTruthy()
  })

  it('throws the documented "Missing required env" error on first db method call', async () => {
    const { db } = await import('../drizzle')
    expect(() => db.select()).toThrow('Missing required env: TURSO_DATABASE_URL')
  })
})
