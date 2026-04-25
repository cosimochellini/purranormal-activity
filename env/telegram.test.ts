import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Helper: load `env/telegram.ts` fresh after the env has been mutated.
// Uses dynamic import so the module is re-evaluated against the current
// `process.env` snapshot (vi.resetModules clears the module registry).
async function loadTelegramModule() {
  vi.resetModules()
  return await import('./telegram')
}

describe('env/telegram (Bug #1 regression)', () => {
  const originalChatIds = process.env.TELEGRAM_BOT_CHAT_IDS
  const originalApiKey = process.env.TELEGRAM_BOT_API_KEY

  beforeEach(() => {
    vi.resetModules()
  })

  afterEach(() => {
    // Restore originals so the rest of the suite isn't perturbed.
    if (originalChatIds === undefined) {
      delete process.env.TELEGRAM_BOT_CHAT_IDS
    } else {
      process.env.TELEGRAM_BOT_CHAT_IDS = originalChatIds
    }
    if (originalApiKey === undefined) {
      delete process.env.TELEGRAM_BOT_API_KEY
    } else {
      process.env.TELEGRAM_BOT_API_KEY = originalApiKey
    }
    vi.resetModules()
  })

  it('does not throw when TELEGRAM_BOT_CHAT_IDS is undefined and resolves to []', async () => {
    delete process.env.TELEGRAM_BOT_CHAT_IDS
    process.env.TELEGRAM_BOT_API_KEY = 'fake-key'

    const { logger } = await import('../utils/logger')
    const warnSpy = vi.mocked(logger.warn)
    warnSpy.mockClear()

    const mod = await loadTelegramModule()

    expect(mod.TELEGRAM_BOT_CHAT_IDS).toEqual([])
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('TELEGRAM_BOT_CHAT_IDS is not set'),
    )
  })

  it('parses TELEGRAM_BOT_CHAT_IDS into a trimmed list when present', async () => {
    process.env.TELEGRAM_BOT_CHAT_IDS = '123,456,'
    process.env.TELEGRAM_BOT_API_KEY = 'fake-key'

    const mod = await loadTelegramModule()

    expect(mod.TELEGRAM_BOT_CHAT_IDS).toEqual(['123', '456'])
  })

  it('warns when TELEGRAM_BOT_API_KEY is missing and exposes empty string', async () => {
    delete process.env.TELEGRAM_BOT_API_KEY
    process.env.TELEGRAM_BOT_CHAT_IDS = '7'

    const { logger } = await import('../utils/logger')
    const warnSpy = vi.mocked(logger.warn)
    warnSpy.mockClear()

    const mod = await loadTelegramModule()

    expect(mod.TELEGRAM_BOT_API_KEY).toBe('')
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('TELEGRAM_BOT_API_KEY is not set'))
  })
})
