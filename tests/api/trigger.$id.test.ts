import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/services/log', () => ({
  setLogError: vi.fn(async () => undefined),
}))

vi.mock('@/services/trigger', () => ({
  generateLogImage: vi.fn(async () => undefined),
}))

import { setLogError } from '@/services/log'
import { generateLogImage } from '@/services/trigger'
import { Route } from '@/start/routes/api/trigger/$id'

const POST = Route.options.server?.handlers?.POST as (ctx: {
  params: { id: string }
}) => Promise<Response>

const callPost = (id: string) => POST({ params: { id } })

describe('POST /api/trigger/$id', () => {
  beforeEach(() => {
    vi.mocked(setLogError).mockReset()
    vi.mocked(generateLogImage).mockReset()
  })

  it('rejects a non-numeric id without calling the service or emitting X-Invalidate', async () => {
    const res = await callPost('abc')
    expect(await res.json()).toEqual({ success: false, error: 'Invalid log id' })
    expect(res.headers.get('X-Invalidate')).toBeNull()
    expect(generateLogImage).not.toHaveBeenCalled()
  })

  it('triggers image generation and emits X-Invalidate on success', async () => {
    const res = await callPost('7')
    expect(await res.json()).toEqual({ success: true })
    expect(res.headers.get('X-Invalidate')).toBe('log:7')
    expect(generateLogImage).toHaveBeenCalledWith(7)
    expect(setLogError).not.toHaveBeenCalled()
  })

  it('records the error and emits X-Invalidate when the service throws', async () => {
    vi.mocked(generateLogImage).mockRejectedValueOnce(new Error('AI down'))
    const res = await callPost('7')
    expect(await res.json()).toEqual({ success: false, error: 'AI down' })
    // The row was mutated (setLogError ran) so the loader still needs to revalidate.
    expect(res.headers.get('X-Invalidate')).toBe('log:7')
    expect(setLogError).toHaveBeenCalledWith(7, expect.any(Error))
  })
})
