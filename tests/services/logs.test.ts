import { beforeEach, describe, expect, it, vi } from 'vitest'
import { VALIDATION_MESSAGES } from '@/constants'

// Vitest runs without the Start compiler, so `createServerFn` /
// `createMiddleware` are replaced by a recording builder. Each server function
// then exposes its method, middleware list and raw handler, and `call` runs
// them in Start's order: middleware first (on the raw payload), then handler.
interface FakeMiddleware {
  server: (ctx: { data: unknown; next: () => unknown }) => unknown
}
interface FakeServerFn {
  method: string
  middleware: FakeMiddleware[]
  handler: (ctx: { data: unknown }) => unknown
}

vi.mock('@tanstack/react-start', () => ({
  createMiddleware: () => ({ server: (server: FakeMiddleware['server']) => ({ server }) }),
  createServerFn: ({ method }: { method: string }) => {
    let middleware: FakeMiddleware[] = []
    const builder = {
      middleware: (list: FakeMiddleware[]) => {
        middleware = list
        return builder
      },
      validator: () => builder,
      handler: (handler: FakeServerFn['handler']): FakeServerFn => ({
        method,
        middleware,
        handler,
      }),
    }
    return builder
  },
}))

vi.mock('@tanstack/react-start/server', () => ({
  getRequest: () => new Request('https://kitten.test/_serverFn/x'),
}))

vi.mock('@/services/edgeCache.server', () => ({ purgePages: vi.fn() }))

vi.mock('@/services/logActions.server', () => ({
  deleteLog: vi.fn(),
  listLogs: vi.fn(),
  notifyLog: vi.fn(),
  refineLog: vi.fn(),
  submitLog: vi.fn(),
  updateLog: vi.fn(),
  uploadCover: vi.fn(),
}))

const { selectFrom } = vi.hoisted(() => ({ selectFrom: vi.fn() }))
vi.mock('@/drizzle', () => ({ db: { select: () => ({ from: selectFrom }) } }))

import { purgePages } from '@/services/edgeCache.server'
import * as actions from '@/services/logActions.server'
import * as fns from '@/start/services/logs'

const asFake = (fn: unknown) => fn as FakeServerFn

const call = async (fn: unknown, data: unknown) => {
  const { middleware, handler } = asFake(fn)
  const run = (i: number): unknown =>
    i < middleware.length
      ? middleware[i].server({ data, next: () => run(i + 1) })
      : handler({ data })
  return run(0)
}

// `test-setup.ts` stubs SECRET=test-secret.
const SECRET = 'test-secret'

const writes = {
  submitLog: fns.submitLog,
  updateLog: fns.updateLog,
  deleteLog: fns.deleteLog,
  uploadCover: fns.uploadCover,
  notifyLog: fns.notifyLog,
}

beforeEach(() => {
  vi.mocked(actions.submitLog).mockResolvedValue({ success: true, id: 7 })
  vi.mocked(actions.updateLog).mockResolvedValue({
    success: true,
    data: { id: 7 } as never,
  })
  vi.mocked(actions.deleteLog).mockResolvedValue({ success: true })
  vi.mocked(actions.uploadCover).mockResolvedValue({ success: true })
  vi.mocked(actions.notifyLog).mockResolvedValue({ success: true, messageId: 1 })
})

describe('secret gate', () => {
  it.each(Object.entries(writes))('%s is a POST behind the secret middleware', (_name, fn) => {
    expect(asFake(fn).method).toBe('POST')
    expect(asFake(fn).middleware).toHaveLength(1)
  })

  it('refineLog stays public: it never writes', () => {
    expect(asFake(fns.refineLog).middleware).toHaveLength(0)
  })

  it.each(Object.entries(writes))('%s rejects a missing secret before running', async (_n, fn) => {
    await expect(call(fn, { id: 7 })).rejects.toThrow(VALIDATION_MESSAGES.SECRET_REQUIRED)
    for (const action of Object.values(actions)) expect(action).not.toHaveBeenCalled()
  })

  it.each(Object.entries(writes))('%s rejects a wrong secret before running', async (_n, fn) => {
    await expect(call(fn, { id: 7, secret: 'nope' })).rejects.toThrow(
      VALIDATION_MESSAGES.SECRET_INVALID,
    )
    for (const action of Object.values(actions)) expect(action).not.toHaveBeenCalled()
  })

  it('accepts the secret in any case, like the operator routes', async () => {
    await call(fns.deleteLog, { id: 7, secret: SECRET.toUpperCase() })
    expect(actions.deleteLog).toHaveBeenCalledWith(7)
  })

  it('reads the secret from an upload FormData', async () => {
    const form = new FormData()
    form.append('id', '7')
    form.append('secret', 'nope')
    await expect(call(fns.uploadCover, form)).rejects.toThrow(VALIDATION_MESSAGES.SECRET_INVALID)

    form.set('secret', SECRET)
    await call(fns.uploadCover, form)
    expect(actions.uploadCover).toHaveBeenCalledWith(form)
  })
})

describe('edge-cache purge', () => {
  const pages = ['/', '/explore', '/7']

  it('purges the touched pages after a successful write', async () => {
    await call(fns.submitLog, { secret: SECRET })
    await call(fns.updateLog, { id: 7, secret: SECRET })
    await call(fns.deleteLog, { id: 7, secret: SECRET })

    const form = new FormData()
    form.append('id', '7')
    form.append('secret', SECRET)
    await call(fns.uploadCover, form)

    expect(purgePages).toHaveBeenCalledTimes(4)
    for (const args of vi.mocked(purgePages).mock.calls) {
      expect(args).toEqual(['https://kitten.test', pages])
    }
  })

  it('does not purge when the write fails', async () => {
    vi.mocked(actions.submitLog).mockResolvedValueOnce({
      success: false,
      errors: { general: ['nope'] },
    })
    vi.mocked(actions.deleteLog).mockResolvedValueOnce({ success: false, error: 'nope' })

    await call(fns.submitLog, { secret: SECRET })
    await call(fns.deleteLog, { id: 7, secret: SECRET })

    expect(purgePages).not.toHaveBeenCalled()
  })
})

describe('getCategories', () => {
  it('reads once per isolate and retries after a failure', async () => {
    selectFrom.mockRejectedValueOnce(new Error('db down'))
    await expect(call(fns.getCategories, undefined)).rejects.toThrow('db down')

    selectFrom.mockResolvedValueOnce([{ id: 1, name: 'Ghost', icon: 'ghost' }])
    await expect(call(fns.getCategories, undefined)).resolves.toHaveLength(1)
    await call(fns.getCategories, undefined)

    expect(selectFrom).toHaveBeenCalledTimes(2)
  })
})
