import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { makeFakeDb } from '../helpers'

vi.mock('@/drizzle', async () => {
  const { makeFakeDb: make } = await import('../helpers')
  return { db: make() }
})

vi.mock('@/services/imageStore/r2.server', () => ({
  imageStore: {
    put: vi.fn(),
    delete: vi.fn(),
  },
}))

import { imageStore } from '@/services/imageStore/r2.server'
import { Route } from '@/start/routes/api/upload/$id'

const { db: fakeDb } = (await import('@/drizzle')) as unknown as {
  db: ReturnType<typeof makeFakeDb>
}

const POST = Route.options.server?.handlers?.POST as (ctx: {
  request: Request
  params: { id: string }
}) => Promise<Response>

const buildRequest = (id: string, formData: FormData) =>
  new Request(`http://test/api/upload/${id}`, {
    method: 'POST',
    body: formData,
  })

describe('POST /api/upload/$id', () => {
  beforeEach(() => {
    vi.mocked(imageStore.put).mockReset()
  })

  it('returns 400 with `File is required` when the file part is missing', async () => {
    const res = await POST({ request: buildRequest('7', new FormData()), params: { id: '7' } })
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'File is required' })
    expect(imageStore.put).not.toHaveBeenCalled()
  })

  it('returns 400 with `Invalid log ID` when the id is not numeric', async () => {
    const formData = new FormData()
    formData.append('file', new File(['payload'], 'cover.webp', { type: 'image/webp' }))

    const res = await POST({ request: buildRequest('abc', formData), params: { id: 'abc' } })
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'Invalid log ID' })
    expect(imageStore.put).not.toHaveBeenCalled()
  })

  it('uploads the file bytes to imageStore and returns success only (no etag/versionId)', async () => {
    vi.mocked(imageStore.put).mockResolvedValueOnce(undefined)

    const formData = new FormData()
    formData.append('file', new File(['payload'], 'cover.webp', { type: 'image/webp' }))

    const res = await POST({ request: buildRequest('7', formData), params: { id: '7' } })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ success: true })

    expect(imageStore.put).toHaveBeenCalledWith(7, expect.any(Uint8Array))
  })

  it('marks the row ImageGenerated so the cron sweeper cannot overwrite the upload', async () => {
    // Without this the row stays `Created`, and the sweeper would eventually
    // enqueue it, replace the hand-uploaded cover with a generated one, and
    // then mark it `Error`.
    vi.mocked(imageStore.put).mockResolvedValueOnce(undefined)
    vi.mocked(fakeDb.update).mockClear()

    const formData = new FormData()
    formData.append('file', new File(['payload'], 'cover.webp', { type: 'image/webp' }))

    await POST({ request: buildRequest('7', formData), params: { id: '7' } })

    expect(fakeDb.update).toHaveBeenCalledOnce()
    expect(fakeDb.set).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'ImageGenerated', error: null, attempts: 0 }),
    )
  })

  it('returns 400 with the verbatim cause string when imageStore.put throws', async () => {
    vi.mocked(imageStore.put).mockRejectedValueOnce(new Error('boom'))

    const formData = new FormData()
    formData.append('file', new File(['payload'], 'cover.webp', { type: 'image/webp' }))

    const res = await POST({ request: buildRequest('7', formData), params: { id: '7' } })
    expect(res.status).toBe(400)
    const body = (await res.json()) as { error: string }
    // Pre-refactor: `Failed to upload file ${error}` — embeds the cause's
    // `.toString()` (an Error stringifies to `Error: boom`).
    expect(body.error).toBe('Failed to upload file Error: boom')
  })
})
