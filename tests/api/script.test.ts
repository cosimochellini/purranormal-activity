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

  it('invokes runImageGenerationScript and returns its response', async () => {
    vi.mocked(runImageGenerationScript).mockResolvedValueOnce({
      success: true,
      processed: 3,
    })

    const res = await callPost()

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ success: true, processed: 3 })
    expect(runImageGenerationScript).toHaveBeenCalledOnce()
  })

  it('GET responds with 405 Method Not Allowed advertising POST', async () => {
    const res = await callGet()
    expect(res.status).toBe(405)
    expect(res.headers.get('Allow')).toBe('POST')
  })
})
