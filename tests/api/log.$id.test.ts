import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { LogStatus } from '@/data/enum/logStatus'
import type { makeFakeDb } from '../helpers'

vi.mock('@/drizzle', async () => {
  const { makeFakeDb: make } = await import('../helpers')
  return { db: make() }
})

vi.mock('@/env/server', () => ({
  serverEnv: { secret: 'test-secret' },
}))

vi.mock('@/services/imagePipeline', () => ({
  imagePipeline: {
    enqueue: vi.fn(async () => true),
  },
}))

vi.mock('@/services/imageStore/r2.server', () => ({
  imageStore: {
    put: vi.fn(),
    delete: vi.fn(async () => undefined),
  },
}))

import { serverEnv } from '@/env/server'
import { imagePipeline } from '@/services/imagePipeline'

const SECRET = serverEnv.secret

import { imageStore } from '@/services/imageStore/r2.server'
import { Route } from '@/start/routes/api/log/$id'

const { db: fakeDb } = (await import('@/drizzle')) as unknown as {
  db: ReturnType<typeof makeFakeDb>
}

type Handler = (ctx: { request: Request; params: { id: string } }) => Promise<Response>

const GET = Route.options.server?.handlers?.GET as Handler
const PUT = Route.options.server?.handlers?.PUT as Handler
const DELETE = Route.options.server?.handlers?.DELETE as Handler

const jsonRequest = (method: string, body?: unknown) =>
  new Request('http://test/api/log/1', {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: body === undefined ? undefined : { 'content-type': 'application/json' },
  })

describe('GET /api/log/$id', () => {
  beforeEach(() => {
    fakeDb.__reset()
  })

  it('returns success:false when id is not numeric', async () => {
    const res = await GET({ request: jsonRequest('GET'), params: { id: 'abc' } })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ success: false })
  })

  it('returns success:false when no log is found', async () => {
    fakeDb.__queue('where', [])
    const res = await GET({ request: jsonRequest('GET'), params: { id: '7' } })
    expect(await res.json()).toEqual({ success: false })
  })

  it('returns the log entry on a hit', async () => {
    const entry = { id: 7, title: 'spook', description: '...', status: 'Created' as LogStatus }
    // The handler awaits `db.select().from(...).where(...)` which is the
    // chainable proxy — terminal value comes from the last chained call.
    vi.mocked(fakeDb.where).mockReturnValueOnce([entry] as never)

    const res = await GET({ request: jsonRequest('GET'), params: { id: '7' } })
    expect(await res.json()).toEqual({ success: true, data: entry })
  })

  it('returns success:false when the DB throws', async () => {
    vi.mocked(fakeDb.where).mockImplementationOnce(() => {
      throw new Error('boom')
    })
    const res = await GET({ request: jsonRequest('GET'), params: { id: '7' } })
    expect(await res.json()).toEqual({ success: false })
  })
})

describe('PUT /api/log/$id', () => {
  beforeEach(() => {
    fakeDb.__reset()
    vi.mocked(imagePipeline.enqueue).mockClear()
  })

  it('rejects a non-numeric id with a title field error (id-guard fires before body validation)', async () => {
    const res = await PUT({
      request: jsonRequest('PUT', {
        title: 'Valid title',
        description: 'Valid description content',
        categories: [1],
        imageDescription: null,
        secret: SECRET,
      }),
      params: { id: 'nope' },
    })
    const body = (await res.json()) as { success: false; errors: Record<string, string[]> }
    expect(body.success).toBe(false)
    expect(body.errors.title).toEqual(['Invalid log id'])
  })

  it('id-guard wins over body validation when both fail (pre-refactor ordering)', async () => {
    const res = await PUT({
      request: jsonRequest('PUT', {
        title: '',
        description: '',
        categories: [],
        imageDescription: null,
        secret: 'wrong',
      }),
      params: { id: 'nope' },
    })
    const body = (await res.json()) as { success: false; errors: Record<string, string[]> }
    expect(body.success).toBe(false)
    // Only the id-guard's single message — body-level field errors never run.
    expect(body.errors).toEqual({ title: ['Invalid log id'] })
  })

  it('returns flattened field errors when validation fails', async () => {
    const res = await PUT({
      request: jsonRequest('PUT', {
        title: '',
        description: '',
        categories: [],
        imageDescription: null,
        secret: 'wrong',
      }),
      params: { id: '7' },
    })
    const body = (await res.json()) as { success: false; errors: Record<string, string[]> }
    expect(body.success).toBe(false)
    expect(body.errors.title?.length).toBeGreaterThan(0)
    expect(body.errors.description?.length).toBeGreaterThan(0)
    expect(body.errors.categories?.length).toBeGreaterThan(0)
    expect(body.errors.secret?.length).toBeGreaterThan(0)
    // Validation failure → no row mutated → no invalidation tag.
    expect(res.headers.get('X-Invalidate')).toBeNull()
  })

  it('returns "Log not found" when no row matches the id', async () => {
    // After validation passes, the handler looks up the existing log.
    vi.mocked(fakeDb.where).mockReturnValueOnce([] as never)

    const res = await PUT({
      request: jsonRequest('PUT', {
        title: 'Title',
        description: 'Description content',
        categories: [1],
        imageDescription: 'desc',
        secret: SECRET,
      }),
      params: { id: '7' },
    })
    const body = (await res.json()) as { success: false; errors: Record<string, string[]> }
    expect(body.success).toBe(false)
    expect(body.errors.title).toEqual(['Log not found'])
  })

  it('updates the log, replaces categories, and enqueues regeneration on success', async () => {
    const existing = { id: 7, status: 'Created', imageDescription: 'old' }
    const updated = { id: 7, status: 'Created' }

    // 1) lookup existing log
    vi.mocked(fakeDb.where).mockReturnValueOnce([existing] as never)
    // 2) update log .returning() resolves
    fakeDb.__queue('returning', [updated])

    const res = await PUT({
      request: jsonRequest('PUT', {
        title: 'New title',
        description: 'New description content',
        categories: [1, 2],
        imageDescription: 'new image desc',
        secret: SECRET,
      }),
      params: { id: '7' },
    })
    const body = (await res.json()) as { success: true; data: typeof updated }
    expect(body.success).toBe(true)
    expect(body.data).toEqual(updated)
    expect(res.headers.get('X-Invalidate')).toBe('logs,log:7')

    expect(fakeDb.update).toHaveBeenCalled()
    expect(fakeDb.delete).toHaveBeenCalled()
    expect(fakeDb.insert).toHaveBeenCalled()
    expect(imagePipeline.enqueue).toHaveBeenCalledWith(7, 'update')
    // A new prompt is a new generation cycle, so the attempt budget and the
    // previous failure text must be cleared alongside the status flip.
    expect(fakeDb.set).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'Created', attempts: 0, error: null }),
    )
  })

  it('does NOT enqueue when the prompt is unchanged and the row already has its image', async () => {
    // The pre-queue code called the pipeline unconditionally and relied on its
    // `not-pending` skip; under a queue that costs a message plus a DB read.
    const existing = { id: 7, status: 'ImageGenerated', imageDescription: 'same' }
    vi.mocked(fakeDb.where).mockReturnValueOnce([existing] as never)
    fakeDb.__queue('returning', [{ id: 7, status: 'ImageGenerated' }])

    await PUT({
      request: jsonRequest('PUT', {
        title: 'New title',
        description: 'New description content',
        categories: [1],
        imageDescription: 'same',
        secret: SECRET,
      }),
      params: { id: '7' },
    })

    expect(imagePipeline.enqueue).not.toHaveBeenCalled()
  })

  it('DOES enqueue an unchanged prompt when the row is still pending', async () => {
    const existing = { id: 7, status: 'Created', imageDescription: 'same' }
    vi.mocked(fakeDb.where).mockReturnValueOnce([existing] as never)
    fakeDb.__queue('returning', [{ id: 7, status: 'Created' }])

    await PUT({
      request: jsonRequest('PUT', {
        title: 'New title',
        description: 'New description content',
        categories: [1],
        imageDescription: 'same',
        secret: SECRET,
      }),
      params: { id: '7' },
    })

    expect(imagePipeline.enqueue).toHaveBeenCalledWith(7, 'update')
  })

  it('returns the catch-all error response when the DB update throws', async () => {
    vi.mocked(fakeDb.where).mockImplementationOnce(() => {
      throw new Error('db down')
    })
    const res = await PUT({
      request: jsonRequest('PUT', {
        title: 'Title',
        description: 'Description content',
        categories: [1],
        imageDescription: null,
        secret: SECRET,
      }),
      params: { id: '7' },
    })
    const body = (await res.json()) as { success: false; errors: Record<string, string[]> }
    expect(body.success).toBe(false)
    expect(body.errors.title).toEqual(['Failed to update log'])
  })
})

describe('DELETE /api/log/$id', () => {
  beforeEach(() => {
    fakeDb.__reset()
    vi.mocked(imageStore.delete).mockClear()
  })

  it('rejects when the secret is wrong with the pre-refactor `error: Invalid secret` shape', async () => {
    const res = await DELETE({
      request: jsonRequest('DELETE', { secret: 'nope' }),
      params: { id: '7' },
    })
    // Pre-refactor contract: bad secret → `{ success: false, error: 'Invalid secret' }`.
    // The envelope's body-schema would have emitted `errors: { secret: [...] }`
    // instead, so the DELETE handler parses the body itself.
    expect(await res.json()).toEqual({ success: false, error: 'Invalid secret' })
    expect(res.headers.get('X-Invalidate')).toBeNull()
  })

  it('rejects a non-numeric id', async () => {
    const res = await DELETE({
      request: jsonRequest('DELETE', { secret: SECRET }),
      params: { id: 'abc' },
    })
    expect(await res.json()).toEqual({ success: false, error: 'Invalid log id' })
  })

  it('deletes the log row and the R2 image on success', async () => {
    const res = await DELETE({
      request: jsonRequest('DELETE', { secret: SECRET }),
      params: { id: '7' },
    })
    expect(await res.json()).toEqual({ success: true })
    expect(res.headers.get('X-Invalidate')).toBe('logs,log:7')
    expect(fakeDb.delete).toHaveBeenCalled()
    expect(imageStore.delete).toHaveBeenCalledWith(7)
  })

  it('returns the catch-all error response when deletion throws', async () => {
    vi.mocked(imageStore.delete).mockRejectedValueOnce(new Error('r2 down'))
    const res = await DELETE({
      request: jsonRequest('DELETE', { secret: SECRET }),
      params: { id: '7' },
    })
    expect(await res.json()).toEqual({ success: false, error: 'Failed to delete log' })
  })
})
