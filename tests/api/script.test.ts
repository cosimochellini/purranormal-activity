import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/services/imagePipeline', () => ({
  imagePipeline: {
    drain: vi.fn(async () => ({ processed: 0, failed: 0 })),
  },
}))

import { imagePipeline } from '@/services/imagePipeline'
import { Route } from '@/start/routes/api/script'

const POST = Route.options.server?.handlers?.POST as (ctx: {
  request: Request
}) => Promise<Response>
const GET = Route.options.server?.handlers?.GET as (ctx: { request: Request }) => Promise<Response>

const callPost = () => POST({ request: new Request('http://test/api/script', { method: 'POST' }) })

const callGet = () => GET({ request: new Request('http://test/api/script', { method: 'GET' }) })

describe('POST /api/script', () => {
  beforeEach(() => {
    vi.mocked(imagePipeline.drain).mockReset()
  })

  it('invokes imagePipeline.drain and emits X-Invalidate when rows were processed', async () => {
    vi.mocked(imagePipeline.drain).mockResolvedValueOnce({ processed: 3, failed: 0 })

    const res = await callPost()

    expect(res.status).toBe(200)
    expect(res.headers.get('X-Invalidate')).toBe('logs')
    expect(await res.json()).toEqual({ success: true, processed: 3 })
    expect(imagePipeline.drain).toHaveBeenCalledOnce()
  })

  it('omits X-Invalidate when no rows were processed (idle batch)', async () => {
    vi.mocked(imagePipeline.drain).mockResolvedValueOnce({ processed: 0, failed: 0 })

    const res = await callPost()

    expect(res.status).toBe(200)
    expect(res.headers.get('X-Invalidate')).toBeNull()
    expect(await res.json()).toEqual({ success: true, processed: 0 })
  })

  it('routes a thrown drain() through the reporter as a failure response', async () => {
    vi.mocked(imagePipeline.drain).mockRejectedValueOnce(new Error('db down'))

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
