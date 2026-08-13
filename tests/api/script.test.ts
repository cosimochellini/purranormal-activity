import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/services/imagePipeline', () => ({
  imagePipeline: {
    enqueuePending: vi.fn(async () => ({ processed: 0 })),
  },
}))

import { imagePipeline } from '@/services/imagePipeline'
import { Route } from '@/start/routes/api/script'

const POST = Route.options.server?.handlers?.POST as (ctx: {
  request: Request
}) => Promise<Response>
const GET = Route.options.server?.handlers?.GET as (ctx: { request: Request }) => Promise<Response>

// `test-setup.ts` stubs SECRET=test-secret.
const callPost = (body: unknown = { secret: 'test-secret' }) =>
  POST({
    request: new Request('http://test/api/script', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
  })

const callGet = () => GET({ request: new Request('http://test/api/script', { method: 'GET' }) })

describe('POST /api/script', () => {
  beforeEach(() => {
    vi.mocked(imagePipeline.enqueuePending).mockReset()
    vi.mocked(imagePipeline.enqueuePending).mockResolvedValue({ processed: 0 })
  })

  it('enqueues the pending rows and reports how many', async () => {
    vi.mocked(imagePipeline.enqueuePending).mockResolvedValueOnce({ processed: 3 })

    const res = await callPost()

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ success: true, processed: 3 })
    expect(imagePipeline.enqueuePending).toHaveBeenCalledOnce()
  })

  it('never emits X-Invalidate — enqueueing mutates no row a loader reads', async () => {
    vi.mocked(imagePipeline.enqueuePending).mockResolvedValueOnce({ processed: 3 })

    const res = await callPost()

    expect(res.headers.get('X-Invalidate')).toBeNull()
  })

  it('reports processed:0 for an idle queue', async () => {
    const res = await callPost()

    expect(await res.json()).toEqual({ success: true, processed: 0 })
  })

  it.each([
    ['a missing secret', {}],
    ['a wrong secret', { secret: 'nope' }],
  ])('rejects %s without enqueueing anything', async (_label, body) => {
    // The envelope owns validation failures, so the shape here is
    // `{ success, errors }` rather than the reporter's `{ success, processed, error }`.
    const res = await callPost(body)
    const parsed = (await res.json()) as { success: boolean; errors: Record<string, string[]> }

    expect(parsed.success).toBe(false)
    expect(parsed.errors.secret).toBeDefined()
    expect(imagePipeline.enqueuePending).not.toHaveBeenCalled()
  })

  it('routes a thrown enqueuePending() through the reporter as a failure response', async () => {
    vi.mocked(imagePipeline.enqueuePending).mockRejectedValueOnce(new Error('db down'))

    const res = await callPost()
    const body = (await res.json()) as { success: false; processed: number; error: string }
    expect(body.success).toBe(false)
    expect(body.processed).toBe(0)
    expect(body.error).toMatch(/process logs|temporarily unavailable/i)
    expect(res.headers.get('X-Invalidate')).toBeNull()
  })

  it('GET responds with 405 Method Not Allowed advertising POST', async () => {
    const res = await callGet()
    expect(res.status).toBe(405)
    expect(res.headers.get('Allow')).toBe('POST')
  })
})
