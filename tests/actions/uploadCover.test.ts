import { beforeEach, describe, expect, it, vi } from 'vitest'
import { UPLOAD_LIMITS } from '@/constants'
import type { makeFakeDb } from '../helpers'

vi.mock('@/drizzle', async () => {
  const { makeFakeDb: make } = await import('../helpers')
  return { db: make() }
})

vi.mock('@/services/imagePipeline', () => ({ imagePipeline: {} }))
vi.mock('@/services/notifier', () => ({ notifier: {} }))
vi.mock('@/services/log', () => ({ getLog: vi.fn(), getLogs: vi.fn() }))
vi.mock('@/services/storyForge', () => ({ storyForge: {} }))

vi.mock('@/services/imageStore/r2.server', () => ({
  imageStore: {
    put: vi.fn(),
    delete: vi.fn(),
  },
}))

import { imageStore } from '@/services/imageStore/r2.server'
import { uploadCover } from '@/services/logActions.server'

const { db: fakeDb } = (await import('@/drizzle')) as unknown as {
  db: ReturnType<typeof makeFakeDb>
}

const form = (
  id: string | number | null = 7,
  file: File | null = new File(['payload'], 'cover.webp', { type: 'image/webp' }),
) => {
  const formData = new FormData()
  if (file) formData.append('file', file)
  if (id !== null) formData.append('id', String(id))
  return formData
}

describe('uploadCover', () => {
  beforeEach(() => {
    vi.mocked(imageStore.put).mockReset()
    vi.mocked(fakeDb.update).mockClear()
    // Default: the log row exists.
    fakeDb.get.mockReset()
    fakeDb.get.mockResolvedValue({ id: 7 })
  })

  it('returns `File is required` when the file part is missing', async () => {
    expect(await uploadCover(form(7, null))).toEqual({ success: false, error: 'File is required' })
    expect(imageStore.put).not.toHaveBeenCalled()
  })

  it('returns `File is required` when the file part is a plain string', async () => {
    const formData = new FormData()
    formData.append('file', 'not-a-file')
    formData.append('id', '7')

    expect(await uploadCover(formData)).toEqual({ success: false, error: 'File is required' })
    expect(imageStore.put).not.toHaveBeenCalled()
  })

  it.each([
    ['not numeric', 'abc'],
    ['zero', 0],
    ['negative', -2],
    ['fractional', 1.5],
    ['missing', null],
  ])('returns `Invalid log ID` when the id is %s', async (_label, id) => {
    expect(await uploadCover(form(id))).toEqual({ success: false, error: 'Invalid log ID' })
    expect(imageStore.put).not.toHaveBeenCalled()
  })

  it('uploads the file bytes to imageStore and returns success only (no etag/versionId)', async () => {
    vi.mocked(imageStore.put).mockResolvedValueOnce(undefined)

    expect(await uploadCover(form())).toEqual({ success: true })

    expect(imageStore.put).toHaveBeenCalledWith(7, expect.any(Uint8Array))
    const bytes = vi.mocked(imageStore.put).mock.calls[0]?.[1] as Uint8Array
    expect(new TextDecoder().decode(bytes)).toBe('payload')
  })

  it.each([
    [
      'a non-image file',
      new File(['payload'], 'notes.txt', { type: 'text/plain' }),
      'File must be an image',
    ],
    [
      'a file over 5 MB',
      new File([new Uint8Array(UPLOAD_LIMITS.MAX_BYTES + 1)], 'big.png', { type: 'image/png' }),
      'File is too large (max 5 MB)',
    ],
  ])('rejects %s without writing anything', async (_label, file, error) => {
    expect(await uploadCover(form(7, file))).toEqual({ success: false, error })
    expect(imageStore.put).not.toHaveBeenCalled()
    expect(fakeDb.update).not.toHaveBeenCalled()
  })

  it('accepts a file of exactly the size limit', async () => {
    vi.mocked(imageStore.put).mockResolvedValueOnce(undefined)
    const exact = new File([new Uint8Array(UPLOAD_LIMITS.MAX_BYTES)], 'edge.png', {
      type: 'image/png',
    })

    expect(await uploadCover(form(7, exact))).toEqual({ success: true })
    expect(imageStore.put).toHaveBeenCalledOnce()
  })

  it('accepts non-webp images (e.g. a phone JPEG)', async () => {
    vi.mocked(imageStore.put).mockResolvedValueOnce(undefined)
    const jpeg = new File(['payload'], 'photo.jpg', { type: 'image/jpeg' })

    expect(await uploadCover(form(7, jpeg))).toEqual({ success: true })
    expect(imageStore.put).toHaveBeenCalledOnce()
  })

  it('returns `Log not found` for an unknown id without writing an orphan object', async () => {
    fakeDb.get.mockResolvedValueOnce(undefined)

    expect(await uploadCover(form(999))).toEqual({ success: false, error: 'Log not found' })
    expect(imageStore.put).not.toHaveBeenCalled()
    expect(fakeDb.update).not.toHaveBeenCalled()
  })

  it('marks the row ImageGenerated so the cron sweeper cannot overwrite the upload', async () => {
    // Without this the row stays `Created`, and the sweeper would eventually
    // enqueue it, replace the hand-uploaded cover with a generated one, and
    // then mark it `Error`.
    vi.mocked(imageStore.put).mockResolvedValueOnce(undefined)

    await uploadCover(form())

    expect(fakeDb.update).toHaveBeenCalledOnce()
    expect(fakeDb.set).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'ImageGenerated', error: null, attempts: 0 }),
    )
  })

  it('keeps the cause out of the response when imageStore.put throws, and does not flip the status', async () => {
    vi.mocked(imageStore.put).mockRejectedValueOnce(new Error('boom'))

    expect(await uploadCover(form())).toEqual({
      success: false,
      error: 'Failed to upload file',
    })
    expect(fakeDb.update).not.toHaveBeenCalled()
  })
})
