import { vi } from 'vitest'

// ---------------------------------------------------------------------------
// Drizzle / libsql fake builder.
// `makeFakeDb()` returns a chainable proxy that mimics the Drizzle query
// builder. Every chainable method returns the same proxy. Terminal methods
// (`.all()`, `.get()`, `.returning()`, `.run()`, `.execute()`) return the
// promise queued by the test.
//
// Usage in a test:
//   const db = makeFakeDb()
//   db.__queue('all', [{ id: 1 }])
//   // ... import the module that uses db, run code, then assert
//   expect(db.select).toHaveBeenCalled()
// ---------------------------------------------------------------------------

export interface FakeDb {
  // Spied chainable methods
  select: ReturnType<typeof vi.fn>
  from: ReturnType<typeof vi.fn>
  where: ReturnType<typeof vi.fn>
  leftJoin: ReturnType<typeof vi.fn>
  innerJoin: ReturnType<typeof vi.fn>
  rightJoin: ReturnType<typeof vi.fn>
  fullJoin: ReturnType<typeof vi.fn>
  orderBy: ReturnType<typeof vi.fn>
  groupBy: ReturnType<typeof vi.fn>
  having: ReturnType<typeof vi.fn>
  limit: ReturnType<typeof vi.fn>
  offset: ReturnType<typeof vi.fn>
  insert: ReturnType<typeof vi.fn>
  values: ReturnType<typeof vi.fn>
  update: ReturnType<typeof vi.fn>
  set: ReturnType<typeof vi.fn>
  delete: ReturnType<typeof vi.fn>
  onConflictDoNothing: ReturnType<typeof vi.fn>
  onConflictDoUpdate: ReturnType<typeof vi.fn>
  // Terminal methods (resolve to queued values)
  all: ReturnType<typeof vi.fn>
  get: ReturnType<typeof vi.fn>
  returning: ReturnType<typeof vi.fn>
  run: ReturnType<typeof vi.fn>
  execute: ReturnType<typeof vi.fn>
  // Helpers (test-only)
  __queue: (terminal: 'all' | 'get' | 'returning' | 'run' | 'execute', value: unknown) => void
  __reset: () => void
}

export const makeFakeDb = (): FakeDb => {
  const proxy = {} as FakeDb

  const chainable = (name: keyof FakeDb) => {
    proxy[name] = vi.fn(() => proxy) as unknown as FakeDb[typeof name]
  }

  ;(
    [
      'select',
      'from',
      'where',
      'leftJoin',
      'innerJoin',
      'rightJoin',
      'fullJoin',
      'orderBy',
      'groupBy',
      'having',
      'limit',
      'offset',
      'insert',
      'values',
      'update',
      'set',
      'delete',
      'onConflictDoNothing',
      'onConflictDoUpdate',
    ] as const
  ).forEach(chainable)

  const terminal = (name: 'all' | 'get' | 'returning' | 'run' | 'execute') => {
    proxy[name] = vi.fn(async () => undefined) as unknown as FakeDb[typeof name]
  }
  terminal('all')
  terminal('get')
  terminal('returning')
  terminal('run')
  terminal('execute')

  proxy.__queue = (term, value) => {
    ;(proxy[term] as ReturnType<typeof vi.fn>).mockResolvedValueOnce(value)
  }

  proxy.__reset = () => {
    Object.values(proxy).forEach((v) => {
      if (typeof v === 'function' && 'mockReset' in v) {
        ;(v as ReturnType<typeof vi.fn>).mockReset()
        // re-arm chainables to return the proxy
      }
    })
  }

  return proxy
}

// ---------------------------------------------------------------------------
// fetch mocks
// ---------------------------------------------------------------------------

export const mockFetchOnce = (body: unknown, init: ResponseInit = { status: 200 }) => {
  const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>
  const responseBody = typeof body === 'string' ? body : JSON.stringify(body)
  fetchMock.mockResolvedValueOnce(
    new Response(responseBody, {
      headers: { 'content-type': 'application/json' },
      ...init,
    }),
  )
}

export const mockFetchSequence = (responses: Array<{ body: unknown; init?: ResponseInit }>) => {
  for (const { body, init } of responses) {
    mockFetchOnce(body, init)
  }
}

export const mockFetchReject = (error: Error = new Error('network error')) => {
  const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>
  fetchMock.mockRejectedValueOnce(error)
}

// ---------------------------------------------------------------------------
// OpenAI client mock factory
// ---------------------------------------------------------------------------

export interface MockOpenAIOptions {
  chatCompletion?: unknown
  imageGenerate?: unknown
  responseCreate?: unknown
}

export const mockOpenAIClient = (options: MockOpenAIOptions = {}) => ({
  chat: {
    completions: {
      create: vi.fn(
        async () => options.chatCompletion ?? { choices: [{ message: { content: '{}' } }] },
      ),
    },
  },
  images: {
    generate: vi.fn(async () => options.imageGenerate ?? { data: [{ b64_json: 'AAAA' }] }),
  },
  responses: {
    create: vi.fn(async () => options.responseCreate ?? { output_text: '{}' }),
  },
})

// ---------------------------------------------------------------------------
// S3 / R2 client mock factory
// ---------------------------------------------------------------------------

export const mockS3Client = () => {
  const send = vi.fn(async () => ({}))
  const client = { send }
  return { client, send }
}
