import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/services/imagePipeline', () => ({
  imagePipeline: {
    retry: vi.fn(),
  },
}))

import { imagePipeline } from '@/services/imagePipeline'
import { Route } from '@/start/routes/api/trigger/$id'

const POST = Route.options.server?.handlers?.POST as (ctx: {
  request: Request
  params: { id: string }
}) => Promise<Response>

// `test-setup.ts` stubs SECRET=test-secret.
const callPost = (id: string, body: unknown = { secret: 'test-secret' }) =>
  POST({
    request: new Request(`http://test/api/trigger/${id}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
    params: { id },
  })

describe('POST /api/trigger/$id', () => {
  beforeEach(() => {
    vi.mocked(imagePipeline.retry).mockReset()
  })

  it.each([
    ['a missing secret', {}],
    ['a wrong secret', { secret: 'nope' }],
  ])('rejects %s without touching the pipeline', async (_label, body) => {
    // Enqueueing is cheap for the caller and expensive for us: every message
    // becomes a paid image generation.
    const res = await callPost('7', body)
    const parsed = (await res.json()) as { success: boolean; errors: Record<string, string[]> }

    expect(parsed.success).toBe(false)
    expect(parsed.errors.secret).toBeDefined()
    expect(imagePipeline.retry).not.toHaveBeenCalled()
  })

  it('rejects a non-numeric id without calling the pipeline', async () => {
    const res = await callPost('abc')

    expect(await res.json()).toEqual({ success: false, error: 'Invalid log id' })
    expect(res.headers.get('X-Invalidate')).toBeNull()
    expect(imagePipeline.retry).not.toHaveBeenCalled()
  })

  it('requeues and enqueues, emitting X-Invalidate so the UI shows the pending state', async () => {
    vi.mocked(imagePipeline.retry).mockResolvedValueOnce({ requeued: true, enqueued: true })

    const res = await callPost('7')

    expect(await res.json()).toEqual({ success: true })
    expect(res.headers.get('X-Invalidate')).toBe('log:7')
    expect(imagePipeline.retry).toHaveBeenCalledWith(7)
  })

  it('reports not-found when the row does not exist', async () => {
    vi.mocked(imagePipeline.retry).mockResolvedValueOnce({ requeued: false, enqueued: false })

    const res = await callPost('7')

    expect(await res.json()).toEqual({ success: false, error: 'not-found' })
    expect(res.headers.get('X-Invalidate')).toBeNull()
  })

  it('surfaces an enqueue failure but still invalidates (the row is pending again)', async () => {
    vi.mocked(imagePipeline.retry).mockResolvedValueOnce({ requeued: true, enqueued: false })

    const res = await callPost('7')

    expect(await res.json()).toEqual({
      success: false,
      error: 'Failed to enqueue image generation',
    })
    expect(res.headers.get('X-Invalidate')).toBe('log:7')
  })

  it('routes a thrown retry() through the reporter', async () => {
    vi.mocked(imagePipeline.retry).mockRejectedValueOnce(new Error('db down'))

    const res = await callPost('7')
    const body = (await res.json()) as { success: false; error: string }

    expect(body.success).toBe(false)
    expect(body.error).toMatch(/pipeline failed|temporarily unavailable/i)
  })
})
