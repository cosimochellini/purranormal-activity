import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/services/imagePipeline', () => ({
  imagePipeline: {
    generateImageFor: vi.fn(),
  },
}))

import { imagePipeline } from '@/services/imagePipeline'
import { Route } from '@/start/routes/api/trigger/$id'

const POST = Route.options.server?.handlers?.POST as (ctx: {
  params: { id: string }
}) => Promise<Response>

const callPost = (id: string) => POST({ params: { id } })

describe('POST /api/trigger/$id', () => {
  beforeEach(() => {
    vi.mocked(imagePipeline.generateImageFor).mockReset()
  })

  it('rejects a non-numeric id without calling the pipeline or emitting X-Invalidate', async () => {
    const res = await callPost('abc')
    expect(await res.json()).toEqual({ success: false, error: 'Invalid log id' })
    expect(res.headers.get('X-Invalidate')).toBeNull()
    expect(imagePipeline.generateImageFor).not.toHaveBeenCalled()
  })

  it('returns success and emits X-Invalidate on report.status === "success"', async () => {
    vi.mocked(imagePipeline.generateImageFor).mockResolvedValueOnce({
      status: 'success',
      logId: 7,
    })

    const res = await callPost('7')
    expect(await res.json()).toEqual({ success: true })
    expect(res.headers.get('X-Invalidate')).toBe('log:7')
    expect(imagePipeline.generateImageFor).toHaveBeenCalledWith(7)
  })

  it('returns the report.message and emits X-Invalidate on report.status === "failed"', async () => {
    vi.mocked(imagePipeline.generateImageFor).mockResolvedValueOnce({
      status: 'failed',
      logId: 7,
      message: 'AI down',
    })

    const res = await callPost('7')
    expect(await res.json()).toEqual({ success: false, error: 'AI down' })
    expect(res.headers.get('X-Invalidate')).toBe('log:7')
  })

  it('omits X-Invalidate on skipped:not-found', async () => {
    vi.mocked(imagePipeline.generateImageFor).mockResolvedValueOnce({
      status: 'skipped',
      logId: 7,
      reason: 'not-found',
    })

    const res = await callPost('7')
    expect(await res.json()).toEqual({ success: false, error: 'not-found' })
    expect(res.headers.get('X-Invalidate')).toBeNull()
  })

  it('emits X-Invalidate on skipped:not-pending (the row exists, the loader still revalidates)', async () => {
    vi.mocked(imagePipeline.generateImageFor).mockResolvedValueOnce({
      status: 'skipped',
      logId: 7,
      reason: 'not-pending',
    })

    const res = await callPost('7')
    expect(await res.json()).toEqual({ success: false, error: 'not-pending' })
    expect(res.headers.get('X-Invalidate')).toBe('log:7')
  })

  it('falls back to "Unknown error" when report.message is missing on a failed status', async () => {
    vi.mocked(imagePipeline.generateImageFor).mockResolvedValueOnce({
      status: 'failed',
      logId: 7,
    })

    const res = await callPost('7')
    expect(await res.json()).toEqual({ success: false, error: 'Unknown error' })
  })
})
