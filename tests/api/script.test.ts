import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/services/script', () => ({
  runImageGenerationScript: vi.fn(),
}))

import { runImageGenerationScript } from '@/services/script'
import { Route } from '@/start/routes/api/script'

const POST = Route.options.server?.handlers?.POST as (ctx: {
  request: Request
}) => Promise<Response>
const GET = Route.options.server?.handlers?.GET as (ctx: { request: Request }) => Promise<Response>

const callPost = () => POST({ request: new Request('http://test/api/script', { method: 'POST' }) })

const callGet = () => GET({ request: new Request('http://test/api/script', { method: 'GET' }) })

describe('POST /api/script', () => {
  beforeEach(() => {
    vi.mocked(runImageGenerationScript).mockReset()
  })

  it('invokes runImageGenerationScript and emits X-Invalidate when rows were processed', async () => {
    vi.mocked(runImageGenerationScript).mockResolvedValueOnce({
      success: true,
      processed: 3,
    })

    const res = await callPost()

    expect(res.status).toBe(200)
    expect(res.headers.get('X-Invalidate')).toBe('logs')
    expect(await res.json()).toEqual({ success: true, processed: 3 })
    expect(runImageGenerationScript).toHaveBeenCalledOnce()
  })

  it('omits X-Invalidate when no rows were processed (idle batch)', async () => {
    vi.mocked(runImageGenerationScript).mockResolvedValueOnce({
      success: true,
      processed: 0,
    })

    const res = await callPost()

    expect(res.status).toBe(200)
    expect(res.headers.get('X-Invalidate')).toBeNull()
  })

  it('omits X-Invalidate on the failure response', async () => {
    vi.mocked(runImageGenerationScript).mockResolvedValueOnce({
      success: false,
      processed: 0,
      error: 'Failed to process logs',
    })

    const res = await callPost()
    expect(res.headers.get('X-Invalidate')).toBeNull()
  })

  it('GET responds with 405 Method Not Allowed advertising POST', async () => {
    const res = await callGet()
    expect(res.status).toBe(405)
    expect(res.headers.get('Allow')).toBe('POST')
  })
})
