import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/utils/cloudflare', () => ({
  uploadToR2: vi.fn(),
}))

import { Route } from '@/start/routes/api/upload/$id'
import { uploadToR2 } from '@/utils/cloudflare'

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
    vi.mocked(uploadToR2).mockReset()
  })

  it('returns 400 when the file part is missing', async () => {
    const res = await POST({ request: buildRequest('7', new FormData()), params: { id: '7' } })
    expect(res.status).toBe(400)
    expect(uploadToR2).not.toHaveBeenCalled()
  })

  it('returns 400 when the id is not numeric', async () => {
    const formData = new FormData()
    formData.append('file', new File(['payload'], 'cover.webp', { type: 'image/webp' }))

    const res = await POST({ request: buildRequest('abc', formData), params: { id: 'abc' } })
    expect(res.status).toBe(400)
    expect(uploadToR2).not.toHaveBeenCalled()
  })

  it('uploads the file buffer to R2 and returns the result metadata', async () => {
    vi.mocked(uploadToR2).mockResolvedValueOnce({
      ETag: '"etag-1"',
      VersionId: 'v1',
    } as never)

    const formData = new FormData()
    formData.append('file', new File(['payload'], 'cover.webp', { type: 'image/webp' }))

    const res = await POST({ request: buildRequest('7', formData), params: { id: '7' } })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      success: true,
      result: { etag: '"etag-1"', versionId: 'v1' },
    })

    expect(uploadToR2).toHaveBeenCalledWith(expect.any(Buffer), 7)
  })

  it('returns 400 with an error message when uploadToR2 throws', async () => {
    vi.mocked(uploadToR2).mockRejectedValueOnce(new Error('boom'))

    const formData = new FormData()
    formData.append('file', new File(['payload'], 'cover.webp', { type: 'image/webp' }))

    const res = await POST({ request: buildRequest('7', formData), params: { id: '7' } })
    expect(res.status).toBe(400)
    const body = (await res.json()) as { error: string }
    expect(body.error).toMatch(/Failed to upload file/i)
  })
})
