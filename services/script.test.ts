import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { makeFakeDb } from '../tests/helpers'

vi.mock('@/drizzle', async () => {
  const { makeFakeDb: make } = await import('../tests/helpers')
  return { db: make() }
})

vi.mock('@/services/trigger', () => ({
  generateLogImage: vi.fn(async () => undefined),
}))

vi.mock('@/services/content', () => ({
  invalidatePublicContent: vi.fn(async () => undefined),
}))

vi.mock('@/utils/promise', () => ({
  wait: vi.fn(async () => undefined),
}))

import { invalidatePublicContent } from '@/services/content'
import { runImageGenerationScript } from '@/services/script'
import { generateLogImage } from '@/services/trigger'
import { wait } from '@/utils/promise'

const { db: fakeDb } = (await import('@/drizzle')) as unknown as {
  db: ReturnType<typeof makeFakeDb>
}

describe('runImageGenerationScript', () => {
  beforeEach(() => {
    fakeDb.__reset()
    vi.mocked(generateLogImage).mockReset()
    vi.mocked(invalidatePublicContent).mockReset()
    vi.mocked(wait).mockReset()
    vi.mocked(generateLogImage).mockImplementation(async () => undefined)
    vi.mocked(invalidatePublicContent).mockImplementation(async () => undefined)
    vi.mocked(wait).mockImplementation(async () => undefined)
  })

  it('returns processed:0 and skips invalidation when no logs are pending', async () => {
    // db.select(...).from(...).where(...) resolves to []
    vi.mocked(fakeDb.where).mockReturnValueOnce([] as never)

    const result = await runImageGenerationScript()
    expect(result).toEqual({ success: true, processed: 0 })
    expect(generateLogImage).not.toHaveBeenCalled()
    expect(invalidatePublicContent).not.toHaveBeenCalled()
  })

  it('processes pending logs in batches of 5 with a delay between batches', async () => {
    const logs = Array.from({ length: 12 }, (_, i) => ({ id: i + 1 }))
    vi.mocked(fakeDb.where).mockReturnValueOnce(logs as never)

    const result = await runImageGenerationScript()
    expect(result).toEqual({ success: true, processed: 12 })

    // 12 logs / 5 per batch = ceil(12/5) = 3 batches → 3 wait calls.
    expect(generateLogImage).toHaveBeenCalledTimes(12)
    expect(wait).toHaveBeenCalledTimes(3)
    expect(wait).toHaveBeenCalledWith(5000)
    expect(invalidatePublicContent).toHaveBeenCalledOnce()
  })

  it('keeps going when a single log fails (per-log try/catch)', async () => {
    const logs = [{ id: 1 }, { id: 2 }, { id: 3 }]
    vi.mocked(fakeDb.where).mockReturnValueOnce(logs as never)
    vi.mocked(generateLogImage).mockImplementationOnce(async () => {
      throw new Error('fail-one')
    })

    const result = await runImageGenerationScript()
    expect(result).toEqual({ success: true, processed: 3 })
    expect(generateLogImage).toHaveBeenCalledTimes(3)
    expect(invalidatePublicContent).toHaveBeenCalledOnce()
  })

  it('returns success:false when the initial DB select throws', async () => {
    vi.mocked(fakeDb.where).mockImplementationOnce(() => {
      throw new Error('db down')
    })

    const result = await runImageGenerationScript()
    expect(result).toEqual({
      success: false,
      processed: 0,
      error: 'Failed to process logs',
    })
    expect(generateLogImage).not.toHaveBeenCalled()
    expect(invalidatePublicContent).not.toHaveBeenCalled()
  })
})
