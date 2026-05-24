/* eslint-disable node/prefer-global/process */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { logger } from '../utils/logger'
// `env/server.ts` exposes lazy getters, so a single fresh import is enough
// for every test — mutating `process.env` after the module loads must be
// reflected on the very next access.
import { bucket, serverEnv } from './server'

// Snapshot every env key the module touches, then restore in afterEach so
// the wider test suite (especially `test-setup.ts` stubs) is never perturbed.
const TRACKED_KEYS = [
  'TURSO_DATABASE_URL',
  'TURSO_AUTH_TOKEN',
  'OPENAI_API_KEY',
  'ACCESS_KEY_ID',
  'SECRET_ACCESS_KEY',
  'ACCOUNT_ID',
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

describe('bucket.url (lazy composition)', () => {
  it('composes from ACCOUNT_ID at access time, not at module load', () => {
    // The module already loaded above with TRACKED_KEYS wiped — if the value
    // were captured at load it would now throw or hold stale data. Setting
    // the env right before access must take effect.
    process.env.ACCOUNT_ID = 'foo'
    expect(bucket.url).toBe('https://foo.r2.cloudflarestorage.com')
  })

  it('exposes the static bucket name', () => {
    expect(bucket.name).toBe('purranormal-images')
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
