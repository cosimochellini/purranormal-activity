import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/services/content', () => ({
  invalidatePublicContent: vi.fn(async () => undefined),
}))

vi.mock('@/services/log', () => ({
  setLogError: vi.fn(async () => undefined),
}))

vi.mock('@/services/trigger', () => ({
  generateLogImage: vi.fn(async () => undefined),
}))

import { invalidatePublicContent } from '@/services/content'
import { setLogError } from '@/services/log'
import { generateLogImage } from '@/services/trigger'
import { Route } from '@/start/routes/api/trigger/$id'

const POST = Route.options.server?.handlers?.POST as (ctx: {
  params: { id: string }
}) => Promise<Response>

const callPost = (id: string) => POST({ params: { id } })

describe('POST /api/trigger/$id', () => {
  beforeEach(() => {
    vi.mocked(invalidatePublicContent).mockReset()
    vi.mocked(setLogError).mockReset()
    vi.mocked(generateLogImage).mockReset()
  })

  it('rejects a non-numeric id without calling the service', async () => {
    const res = await callPost('abc')
    expect(await res.json()).toEqual({ success: false, error: 'Invalid log id' })
    expect(generateLogImage).not.toHaveBeenCalled()
  })

  it('triggers image generation and invalidates public content on success', async () => {
    const res = await callPost('7')
    expect(await res.json()).toEqual({ success: true })
    expect(generateLogImage).toHaveBeenCalledWith(7)
    expect(invalidatePublicContent).toHaveBeenCalledOnce()
    expect(setLogError).not.toHaveBeenCalled()
  })

  it('records the error on the log and surfaces a message when the service throws', async () => {
    vi.mocked(generateLogImage).mockRejectedValueOnce(new Error('AI down'))
    const res = await callPost('7')
    expect(await res.json()).toEqual({ success: false, error: 'AI down' })
    expect(setLogError).toHaveBeenCalledWith(7, expect.any(Error))
    expect(invalidatePublicContent).not.toHaveBeenCalled()
  })
})
