import { beforeEach, describe, expect, it, vi } from 'vitest'
import { LogStatus } from '@/data/enum/logStatus'
import type { makeFakeDb } from '../tests/helpers'

vi.mock('@/drizzle', async () => {
  const { makeFakeDb: make } = await import('../tests/helpers')
  return { db: make() }
})

vi.mock('@/services/imageGen', () => ({
  generateImageBase64: vi.fn(),
}))

vi.mock('@/services/storyForge', () => ({
  storyForge: {
    questions: vi.fn(),
    logDetails: vi.fn(),
    imagePrompt: vi.fn(),
    telegramMessage: vi.fn(),
    categories: vi.fn(async () => []),
    invalidateCategories: vi.fn(),
  },
}))

vi.mock('@/utils/cloudflare', () => ({
  uploadToR2: vi.fn(async () => undefined),
}))

import { generateImageBase64 } from '@/services/imageGen'
import { storyForge } from '@/services/storyForge'
import {
  generateLogImage,
  triggerFirstPendingImage,
  triggerLogImageIfPending,
} from '@/services/trigger'
import { uploadToR2 } from '@/utils/cloudflare'

const { db: fakeDb } = (await import('@/drizzle')) as unknown as {
  db: ReturnType<typeof makeFakeDb>
}

const resetMocks = () => {
  fakeDb.__reset()
  vi.mocked(storyForge.imagePrompt).mockReset()
  vi.mocked(generateImageBase64).mockReset()
  vi.mocked(uploadToR2).mockReset()
  vi.mocked(uploadToR2).mockImplementation(async () => undefined as never)
}

describe('generateLogImage', () => {
  beforeEach(resetMocks)

  it('throws when the log is not found', async () => {
    vi.mocked(fakeDb.where).mockReturnValueOnce([] as never)
    await expect(generateLogImage(7)).rejects.toThrow('Log not found')
    expect(uploadToR2).not.toHaveBeenCalled()
  })

  it('reuses an existing imageDescription, generates and uploads the image', async () => {
    vi.mocked(fakeDb.where).mockReturnValueOnce([
      { id: 7, description: 'd', imageDescription: 'cached prompt', status: LogStatus.Created },
    ] as never)
    vi.mocked(generateImageBase64).mockResolvedValueOnce('data:image/png;base64,aGVsbG8=')

    await generateLogImage(7)

    expect(storyForge.imagePrompt).not.toHaveBeenCalled()
    expect(generateImageBase64).toHaveBeenCalledWith('cached prompt')
    expect(uploadToR2).toHaveBeenCalledWith(expect.any(Buffer), 7)
    expect(fakeDb.update).toHaveBeenCalled()
    expect(fakeDb.set).toHaveBeenCalledWith({ status: LogStatus.ImageGenerated })
  })

  it('falls back to storyForge.imagePrompt when imageDescription is null', async () => {
    vi.mocked(fakeDb.where).mockReturnValueOnce([
      { id: 7, description: 'a description', imageDescription: null, status: LogStatus.Created },
    ] as never)
    vi.mocked(storyForge.imagePrompt).mockResolvedValueOnce({ ok: true, value: 'fresh prompt' })
    vi.mocked(generateImageBase64).mockResolvedValueOnce('data:image/png;base64,aGVsbG8=')

    await generateLogImage(7)

    expect(storyForge.imagePrompt).toHaveBeenCalledWith('a description')
    expect(generateImageBase64).toHaveBeenCalledWith('fresh prompt')
  })

  it('throws when storyForge.imagePrompt returns ok:false (preserves the per-log catch contract in services/script.ts)', async () => {
    vi.mocked(fakeDb.where).mockReturnValueOnce([
      { id: 7, description: 'a description', imageDescription: null, status: LogStatus.Created },
    ] as never)
    vi.mocked(storyForge.imagePrompt).mockResolvedValueOnce({
      ok: false,
      error: 'model',
      message: 'rate limit',
    })

    await expect(generateLogImage(7)).rejects.toThrow('rate limit')
    expect(generateImageBase64).not.toHaveBeenCalled()
  })
})

describe('triggerLogImageIfPending', () => {
  beforeEach(resetMocks)

  it('returns false when the log does not exist', async () => {
    vi.mocked(fakeDb.where).mockReturnValueOnce([] as never)
    const result = await triggerLogImageIfPending(7)
    expect(result).toBe(false)
    expect(uploadToR2).not.toHaveBeenCalled()
  })

  it('returns false when the log is not in the Created state', async () => {
    vi.mocked(fakeDb.where).mockReturnValueOnce([
      { id: 7, status: LogStatus.ImageGenerated },
    ] as never)
    const result = await triggerLogImageIfPending(7)
    expect(result).toBe(false)
    expect(uploadToR2).not.toHaveBeenCalled()
  })

  it('triggers image generation when the log is pending', async () => {
    vi.mocked(fakeDb.where).mockReturnValueOnce([{ id: 7, status: LogStatus.Created }] as never)
    vi.mocked(fakeDb.where).mockReturnValueOnce([
      { id: 7, description: 'd', imageDescription: 'p', status: LogStatus.Created },
    ] as never)
    vi.mocked(generateImageBase64).mockResolvedValueOnce('data:image/png;base64,aGVsbG8=')

    const result = await triggerLogImageIfPending(7)
    expect(result).toBe(true)
    expect(uploadToR2).toHaveBeenCalledWith(expect.any(Buffer), 7)
  })
})

describe('triggerFirstPendingImage', () => {
  beforeEach(resetMocks)

  it('returns false when there are no pending logs', async () => {
    vi.mocked(fakeDb.limit).mockReturnValueOnce([] as never)
    const result = await triggerFirstPendingImage()
    expect(result).toBe(false)
    expect(uploadToR2).not.toHaveBeenCalled()
  })

  it('triggers image generation for the first pending log', async () => {
    vi.mocked(fakeDb.limit).mockReturnValueOnce([{ id: 11 }] as never)
    vi.mocked(fakeDb.where)
      .mockReturnValueOnce(fakeDb as never)
      .mockReturnValueOnce([
        { id: 11, description: 'd', imageDescription: 'p', status: LogStatus.Created },
      ] as never)
    vi.mocked(generateImageBase64).mockResolvedValueOnce('data:image/png;base64,aGVsbG8=')

    const result = await triggerFirstPendingImage()
    expect(result).toBe(true)
    expect(uploadToR2).toHaveBeenCalledWith(expect.any(Buffer), 11)
  })
})
