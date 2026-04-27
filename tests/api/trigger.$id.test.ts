import { beforeEach, describe, expect, it, vi } from 'vitest'
import { logger } from '@/utils/logger'

vi.mock('@/services/imagePipeline', () => ({
  imagePipeline: {
    generateImageFor: vi.fn(),
  },
  logPipelineOutcome: vi.fn(),
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
    vi.mocked(logger.error).mockClear()
  })

  it('rejects a non-numeric id without calling the pipeline or emitting X-Invalidate', async () => {
    const res = await callPost('abc')
    expect(await res.json()).toEqual({ success: false, error: 'Invalid log id' })
    expect(res.headers.get('X-Invalidate')).toBeNull()
    expect(imagePipeline.generateImageFor).not.toHaveBeenCalled()
  })

  it('returns success and emits X-Invalidate when the pipeline succeeds', async () => {
    vi.mocked(imagePipeline.generateImageFor).mockResolvedValueOnce({ kind: 'success', logId: 7 })

    const res = await callPost('7')
    expect(await res.json()).toEqual({ success: true })
    expect(res.headers.get('X-Invalidate')).toBe('log:7')
    expect(imagePipeline.generateImageFor).toHaveBeenCalledWith(7)
  })

  it('returns the cause message and emits X-Invalidate on failed-recorded', async () => {
    vi.mocked(imagePipeline.generateImageFor).mockResolvedValueOnce({
      kind: 'failed-recorded',
      logId: 7,
      cause: new Error('AI down'),
    })

    const res = await callPost('7')
    expect(await res.json()).toEqual({ success: false, error: 'AI down' })
    expect(res.headers.get('X-Invalidate')).toBe('log:7')
    expect(vi.mocked(logger.error)).toHaveBeenCalledWith(
      'image pipeline recorded an error',
      expect.objectContaining({ logId: 7, cause: expect.any(Error) }),
    )
  })

  it('omits X-Invalidate on skipped:not-found', async () => {
    vi.mocked(imagePipeline.generateImageFor).mockResolvedValueOnce({
      kind: 'skipped',
      logId: 7,
      reason: 'not-found',
    })

    const res = await callPost('7')
    expect(await res.json()).toEqual({ success: false, error: 'not-found' })
    expect(res.headers.get('X-Invalidate')).toBeNull()
  })

  it('emits X-Invalidate on skipped:not-pending (the row exists, the loader still revalidates)', async () => {
    vi.mocked(imagePipeline.generateImageFor).mockResolvedValueOnce({
      kind: 'skipped',
      logId: 7,
      reason: 'not-pending',
    })

    const res = await callPost('7')
    expect(await res.json()).toEqual({ success: false, error: 'not-pending' })
    expect(res.headers.get('X-Invalidate')).toBe('log:7')
  })

  it('returns the cause message and logs cause+writeError on failed-write-also-failed', async () => {
    const cause = new Error('AI down')
    const writeError = new Error('db down')
    vi.mocked(imagePipeline.generateImageFor).mockResolvedValueOnce({
      kind: 'failed-write-also-failed',
      logId: 7,
      cause,
      writeError,
    })

    const res = await callPost('7')
    expect(await res.json()).toEqual({ success: false, error: 'AI down' })
    expect(res.headers.get('X-Invalidate')).toBe('log:7')
    expect(vi.mocked(logger.error)).toHaveBeenCalledWith(
      'image pipeline failed to write the error column',
      expect.objectContaining({ logId: 7, cause, writeError }),
    )
  })

  it('falls back to "Unknown error" when cause is not an Error instance', async () => {
    vi.mocked(imagePipeline.generateImageFor).mockResolvedValueOnce({
      kind: 'failed-recorded',
      logId: 7,
      cause: { code: 'oops' },
    })

    const res = await callPost('7')
    expect(await res.json()).toEqual({ success: false, error: 'Unknown error' })
  })
})
