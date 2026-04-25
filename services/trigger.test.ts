import { beforeEach, describe, expect, it, vi } from 'vitest'
import { LogStatus } from '@/data/enum/logStatus'
import type { makeFakeDb } from '../tests/helpers'

vi.mock('@/drizzle', async () => {
  const { makeFakeDb: make } = await import('../tests/helpers')
  return { db: make() }
})

vi.mock('@/services/ai', () => ({
  generateImagePrompt: vi.fn(),
  generateImageBase64: vi.fn(),
}))

vi.mock('@/utils/cloudflare', () => ({
  uploadToR2: vi.fn(async () => undefined),
}))

import { generateImageBase64, generateImagePrompt } from '@/services/ai'
import {
  generateLogImage,
  triggerFirstPendingImage,
  triggerLogImageIfPending,
} from '@/services/trigger'
import { uploadToR2 } from '@/utils/cloudflare'

const { db: fakeDb } = (await import('@/drizzle')) as unknown as {
  db: ReturnType<typeof makeFakeDb>
}

describe('generateLogImage', () => {
  beforeEach(() => {
    fakeDb.__reset()
    vi.mocked(generateImagePrompt).mockReset()
    vi.mocked(generateImageBase64).mockReset()
    vi.mocked(uploadToR2).mockReset()
    vi.mocked(uploadToR2).mockImplementation(async () => undefined as never)
  })

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

    expect(generateImagePrompt).not.toHaveBeenCalled()
    expect(generateImageBase64).toHaveBeenCalledWith('cached prompt')
    expect(uploadToR2).toHaveBeenCalledWith(expect.any(Buffer), 7)
    expect(fakeDb.update).toHaveBeenCalled()
    expect(fakeDb.set).toHaveBeenCalledWith({ status: LogStatus.ImageGenerated })
  })

  it('falls back to generateImagePrompt when imageDescription is null', async () => {
    vi.mocked(fakeDb.where).mockReturnValueOnce([
      { id: 7, description: 'a description', imageDescription: null, status: LogStatus.Created },
    ] as never)
    vi.mocked(generateImagePrompt).mockResolvedValueOnce('fresh prompt')
    vi.mocked(generateImageBase64).mockResolvedValueOnce('data:image/png;base64,aGVsbG8=')

    await generateLogImage(7)

    expect(generateImagePrompt).toHaveBeenCalledWith('a description')
    expect(generateImageBase64).toHaveBeenCalledWith('fresh prompt')
  })
})

describe('triggerLogImageIfPending', () => {
  beforeEach(() => {
    fakeDb.__reset()
    vi.mocked(generateImagePrompt).mockReset()
    vi.mocked(generateImageBase64).mockReset()
    vi.mocked(uploadToR2).mockReset()
    vi.mocked(uploadToR2).mockImplementation(async () => undefined as never)
  })

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
    // 1) status lookup → Created
    vi.mocked(fakeDb.where).mockReturnValueOnce([{ id: 7, status: LogStatus.Created }] as never)
    // 2) generateLogImage's own log lookup
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
  beforeEach(() => {
    fakeDb.__reset()
    vi.mocked(generateImagePrompt).mockReset()
    vi.mocked(generateImageBase64).mockReset()
    vi.mocked(uploadToR2).mockReset()
    vi.mocked(uploadToR2).mockImplementation(async () => undefined as never)
  })

  it('returns false when there are no pending logs', async () => {
    // limit() is the terminal in the chain.
    vi.mocked(fakeDb.limit).mockReturnValueOnce([] as never)
    const result = await triggerFirstPendingImage()
    expect(result).toBe(false)
    expect(uploadToR2).not.toHaveBeenCalled()
  })

  it('triggers image generation for the first pending log', async () => {
    // Chain 1 (the find-first lookup) ends in `.limit(1)` → that's its terminal.
    vi.mocked(fakeDb.limit).mockReturnValueOnce([{ id: 11 }] as never)
    // Chain 1 still calls `.where()`, but that must remain chainable. Queue
    // a pass-through proxy for chain 1's `.where`, then the terminal for
    // chain 2's `.where` (the one inside generateLogImage).
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
