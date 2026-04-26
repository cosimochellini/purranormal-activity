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
  createDefaultImagePipeline,
  createImagePipeline,
  logPipelineOutcome,
  type PipelineDeps,
} from '@/services/imagePipeline'
import { uploadToR2 } from '@/utils/cloudflare'
import { logger } from '@/utils/logger'

const { db: fakeDb } = (await import('@/drizzle')) as unknown as {
  db: ReturnType<typeof makeFakeDb>
}

const makeDeps = (overrides: Partial<PipelineDeps> = {}): PipelineDeps => ({
  loadStatus: vi.fn(async () => ({ status: LogStatus.Created })),
  generate: vi.fn(async () => undefined),
  markGenerated: vi.fn(async () => undefined),
  recordError: vi.fn(async () => undefined),
  ...overrides,
})

describe('createImagePipeline.run', () => {
  it('returns skipped:not-found when loadStatus returns null', async () => {
    const deps = makeDeps({ loadStatus: vi.fn(async () => null) })
    const pipeline = createImagePipeline(deps)

    const outcome = await pipeline.run(7)

    expect(outcome).toEqual({ kind: 'skipped', logId: 7, reason: 'not-found' })
    expect(deps.generate).not.toHaveBeenCalled()
    expect(deps.markGenerated).not.toHaveBeenCalled()
    expect(deps.recordError).not.toHaveBeenCalled()
  })

  it.each([
    LogStatus.ImageGenerated,
    LogStatus.Error,
  ])('returns skipped:not-pending when status is %s', async (status) => {
    const deps = makeDeps({ loadStatus: vi.fn(async () => ({ status })) })
    const pipeline = createImagePipeline(deps)

    const outcome = await pipeline.run(7)

    expect(outcome).toEqual({ kind: 'skipped', logId: 7, reason: 'not-pending' })
    expect(deps.generate).not.toHaveBeenCalled()
    expect(deps.markGenerated).not.toHaveBeenCalled()
    expect(deps.recordError).not.toHaveBeenCalled()
  })

  it('returns success when generate and markGenerated both resolve', async () => {
    const deps = makeDeps()
    const pipeline = createImagePipeline(deps)

    const outcome = await pipeline.run(7)

    expect(outcome).toEqual({ kind: 'success', logId: 7 })
    expect(deps.generate).toHaveBeenCalledWith(7)
    expect(deps.markGenerated).toHaveBeenCalledWith(7)
    expect(deps.recordError).not.toHaveBeenCalled()
  })

  it('returns failed-recorded when generate throws and recordError succeeds', async () => {
    const cause = new Error('AI down')
    const deps = makeDeps({
      generate: vi.fn(async () => {
        throw cause
      }),
    })
    const pipeline = createImagePipeline(deps)

    const outcome = await pipeline.run(7)

    expect(outcome).toEqual({ kind: 'failed-recorded', logId: 7, cause })
    expect(deps.markGenerated).not.toHaveBeenCalled()
    expect(deps.recordError).toHaveBeenCalledWith(7, cause)
  })

  it('returns failed-recorded when markGenerated throws and recordError succeeds', async () => {
    const cause = new Error('write failed')
    const deps = makeDeps({
      markGenerated: vi.fn(async () => {
        throw cause
      }),
    })
    const pipeline = createImagePipeline(deps)

    const outcome = await pipeline.run(7)

    expect(outcome).toEqual({ kind: 'failed-recorded', logId: 7, cause })
    expect(deps.recordError).toHaveBeenCalledWith(7, cause)
  })

  it('returns failed-write-also-failed when both generate and recordError throw', async () => {
    const cause = new Error('AI down')
    const writeError = new Error('db is down')
    const deps = makeDeps({
      generate: vi.fn(async () => {
        throw cause
      }),
      recordError: vi.fn(async () => {
        throw writeError
      }),
    })
    const pipeline = createImagePipeline(deps)

    const outcome = await pipeline.run(7)

    expect(outcome).toEqual({
      kind: 'failed-write-also-failed',
      logId: 7,
      cause,
      writeError,
    })
  })

  it('returns failed-write-also-failed when markGenerated throws AND recordError throws', async () => {
    const cause = new Error('mark write failed')
    const writeError = new Error('error write also failed')
    const deps = makeDeps({
      markGenerated: vi.fn(async () => {
        throw cause
      }),
      recordError: vi.fn(async () => {
        throw writeError
      }),
    })
    const pipeline = createImagePipeline(deps)

    const outcome = await pipeline.run(7)

    expect(outcome).toEqual({
      kind: 'failed-write-also-failed',
      logId: 7,
      cause,
      writeError,
    })
  })
})

describe('createDefaultImagePipeline default recordError', () => {
  beforeEach(() => fakeDb.__reset())

  it('writes status=Error AND error column in a single update on failed-recorded', async () => {
    const cause = new Error('AI exploded')
    const pipeline = createDefaultImagePipeline({
      loadStatus: async () => ({ status: LogStatus.Created }),
      generate: async () => {
        throw cause
      },
      markGenerated: async () => undefined,
    })

    const outcome = await pipeline.run(42)

    expect(outcome).toEqual({ kind: 'failed-recorded', logId: 42, cause })
    expect(fakeDb.update).toHaveBeenCalledTimes(1)
    expect(fakeDb.set).toHaveBeenCalledWith({
      status: LogStatus.Error,
      error: 'AI exploded',
    })
  })

  it('serializes non-Error causes via JSON.stringify', async () => {
    const cause = { code: 'X', detail: 'plain' }
    const pipeline = createDefaultImagePipeline({
      loadStatus: async () => ({ status: LogStatus.Created }),
      generate: async () => {
        throw cause
      },
      markGenerated: async () => undefined,
    })

    const outcome = await pipeline.run(99)

    expect(outcome.kind).toBe('failed-recorded')
    expect(fakeDb.set).toHaveBeenCalledWith({
      status: LogStatus.Error,
      error: JSON.stringify(cause),
    })
  })

  it('surfaces failed-write-also-failed when the default recordError DB update throws', async () => {
    const cause = new Error('AI exploded')
    const writeError = new Error('db down')
    vi.mocked(fakeDb.where).mockImplementationOnce(() => {
      throw writeError
    })

    const pipeline = createDefaultImagePipeline({
      loadStatus: async () => ({ status: LogStatus.Created }),
      generate: async () => {
        throw cause
      },
      markGenerated: async () => undefined,
    })

    const outcome = await pipeline.run(7)

    expect(outcome).toEqual({
      kind: 'failed-write-also-failed',
      logId: 7,
      cause,
      writeError,
    })
  })
})

describe('createDefaultImagePipeline default generate', () => {
  beforeEach(() => {
    fakeDb.__reset()
    vi.mocked(generateImagePrompt).mockReset()
    vi.mocked(generateImageBase64).mockReset()
    vi.mocked(uploadToR2).mockReset()
    vi.mocked(uploadToR2).mockImplementation(async () => undefined as never)
  })

  it('surfaces failed-recorded with cause "Log not found" when the row vanished between loadStatus and generate', async () => {
    vi.mocked(fakeDb.where).mockReturnValueOnce([] as never)

    const pipeline = createDefaultImagePipeline({
      loadStatus: async () => ({ status: LogStatus.Created }),
      markGenerated: async () => undefined,
      recordError: async () => undefined,
    })

    const outcome = await pipeline.run(7)

    expect(outcome.kind).toBe('failed-recorded')
    if (outcome.kind === 'failed-recorded') {
      expect(outcome.cause).toBeInstanceOf(Error)
      expect((outcome.cause as Error).message).toBe('Log not found')
    }
    expect(uploadToR2).not.toHaveBeenCalled()
  })

  it('reuses an existing imageDescription, decodes the data-URL, and uploads the buffer', async () => {
    vi.mocked(fakeDb.where).mockReturnValueOnce([
      { id: 7, description: 'd', imageDescription: 'cached prompt', status: LogStatus.Created },
    ] as never)
    vi.mocked(generateImageBase64).mockResolvedValueOnce('data:image/png;base64,aGVsbG8=')

    const pipeline = createDefaultImagePipeline({
      loadStatus: async () => ({ status: LogStatus.Created }),
      markGenerated: async () => undefined,
    })

    const outcome = await pipeline.run(7)

    expect(outcome).toEqual({ kind: 'success', logId: 7 })
    expect(generateImagePrompt).not.toHaveBeenCalled()
    expect(generateImageBase64).toHaveBeenCalledWith('cached prompt')
    expect(uploadToR2).toHaveBeenCalledTimes(1)
    const [bufferArg, idArg] = vi.mocked(uploadToR2).mock.calls[0]
    expect(idArg).toBe(7)
    expect(bufferArg).toBeInstanceOf(Buffer)
    expect((bufferArg as Buffer).toString('utf-8')).toBe('hello')
  })

  it('falls back to generateImagePrompt when imageDescription is null', async () => {
    vi.mocked(fakeDb.where).mockReturnValueOnce([
      { id: 7, description: 'a description', imageDescription: null, status: LogStatus.Created },
    ] as never)
    vi.mocked(generateImagePrompt).mockResolvedValueOnce('fresh prompt')
    vi.mocked(generateImageBase64).mockResolvedValueOnce('data:image/png;base64,aGVsbG8=')

    const pipeline = createDefaultImagePipeline({
      loadStatus: async () => ({ status: LogStatus.Created }),
      markGenerated: async () => undefined,
    })

    const outcome = await pipeline.run(7)

    expect(outcome).toEqual({ kind: 'success', logId: 7 })
    expect(generateImagePrompt).toHaveBeenCalledWith('a description')
    expect(generateImageBase64).toHaveBeenCalledWith('fresh prompt')
  })
})

describe('logPipelineOutcome', () => {
  beforeEach(() => {
    vi.mocked(logger.info).mockClear()
    vi.mocked(logger.error).mockClear()
  })

  it('is silent on success', () => {
    logPipelineOutcome({ kind: 'success', logId: 7 }, 'ctx')
    expect(vi.mocked(logger.info)).not.toHaveBeenCalled()
    expect(vi.mocked(logger.error)).not.toHaveBeenCalled()
  })

  it('logs an info line on skipped', () => {
    logPipelineOutcome({ kind: 'skipped', logId: 7, reason: 'not-pending' }, 'ctx')
    expect(vi.mocked(logger.info)).toHaveBeenCalledWith('ctx: pipeline skipped log 7 (not-pending)')
  })

  it('logs an error with the cause on failed-recorded', () => {
    const cause = new Error('AI down')
    logPipelineOutcome({ kind: 'failed-recorded', logId: 7, cause }, 'ctx')
    expect(vi.mocked(logger.error)).toHaveBeenCalledWith(
      'ctx: pipeline recorded an error for log 7',
      { cause },
    )
  })

  it('logs an error with cause + writeError on failed-write-also-failed', () => {
    const cause = new Error('AI down')
    const writeError = new Error('db down')
    logPipelineOutcome({ kind: 'failed-write-also-failed', logId: 7, cause, writeError }, 'ctx')
    expect(vi.mocked(logger.error)).toHaveBeenCalledWith(
      'ctx: pipeline failed to write the error column for log 7',
      { cause, writeError },
    )
  })
})
