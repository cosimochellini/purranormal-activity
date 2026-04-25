import '@testing-library/jest-dom/vitest'
import { afterEach, vi } from 'vitest'

// Default boundary mocks. Individual tests can override per-case via
// `vi.mocked(fetch).mockResolvedValueOnce(...)` etc.

vi.mock('@/utils/logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    log: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}))

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
