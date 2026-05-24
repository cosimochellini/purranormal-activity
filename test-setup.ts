import '@testing-library/jest-dom/vitest'
import { afterEach, vi } from 'vitest'

// Stub the required envs at the very top so any module evaluation triggered
// by transitive imports (notably `@/start/router` -> `routeTree.gen` ->
// API routes -> `env/db.ts`) does not throw with
// `Missing required environment variable: TURSO_DATABASE_URL` during tests.
// Tests that exercise env-validation paths still drive `process.env` directly.
const stubEnv = (key: string, value: string) => {
  if (!process.env[key]) process.env[key] = value
}
stubEnv('TURSO_DATABASE_URL', 'http://test.invalid')
stubEnv('TURSO_AUTH_TOKEN', 'test-token')
stubEnv('ACCOUNT_ID', 'test-account')
stubEnv('ACCESS_KEY_ID', 'test-access-key')
stubEnv('SECRET_ACCESS_KEY', 'test-secret-access-key')
stubEnv('SECRET', 'test-secret')

// Default boundary mocks. Individual tests can override per-case via
// `vi.mocked(fetch).mockResolvedValueOnce(...)` etc.

vi.mock('@/utils/logger', () => {
  const noop = vi.fn()
  const stubLogger = {
    error: vi.fn(),
    warn: vi.fn(),
    log: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  }
  return {
    logger: stubLogger,
    // The route envelope binds a request-scoped logger; default to the same
    // silent spies so route tests don't spam stdout. Individual envelope
    // tests pass an explicit `loggerSink` to inspect calls.
    createScopedLogger: (_meta: unknown, sink?: unknown) => {
      if (typeof sink === 'function') {
        return {
          log: (...args: unknown[]) => (sink as (...a: unknown[]) => void)('log', _meta, args),
          info: (...args: unknown[]) => (sink as (...a: unknown[]) => void)('info', _meta, args),
          warn: (...args: unknown[]) => (sink as (...a: unknown[]) => void)('warn', _meta, args),
          error: (...args: unknown[]) => (sink as (...a: unknown[]) => void)('error', _meta, args),
          debug: (...args: unknown[]) => (sink as (...a: unknown[]) => void)('debug', _meta, args),
        }
      }
      return stubLogger
    },
    noopLoggerSink: noop,
  }
})

vi.mock('nuqs/adapters/tanstack-router', () => ({
  NuqsAdapter: ({ children }: { children: unknown }) => children,
}))

if (!globalThis.fetch || !vi.isMockFunction(globalThis.fetch)) {
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async () =>
        new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } }),
    ),
  )
}

afterEach(() => {
  vi.resetAllMocks()
})
