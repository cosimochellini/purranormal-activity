import { beforeEach, describe, expect, it, vi } from 'vitest'
import { LogStatus } from '@/data/enum/logStatus'
import { logPipelineOutcome } from '@/services/imagePipeline/outcome'
import { logger } from '@/utils/logger'
import { createTestPipeline } from '../../tests/fakes/imagePipeline'

// Boundary suite. NO `vi.mock('@/drizzle')`,
// `vi.mock('@/services/imageGen')`, `vi.mock('@/services/storyForge')`,
// or `vi.mock('@/utils/cloudflare')` — the in-memory adapters from
// `tests/fakes/imagePipeline.ts` replace those at the port level.

describe('pipeline.submit', () => {
  it('inserts a draft, links categories, generates the image, and returns success', async () => {
    const { pipeline, repo, store, aiText, aiImage } = createTestPipeline()

    const result = await pipeline.submit({
      draft: {
        title: 'A whisper at midnight',
        description: 'The kitten knocked over a candle',
        imageDescription: null,
      },
      categoryIds: [1, 2, 3],
    })

    expect(result.id).toBe(1)
    expect(result.outcome).toEqual({ kind: 'success', logId: 1 })

    const row = repo.findRow(1)
    expect(row?.status).toBe(LogStatus.ImageGenerated)
    expect(row?.categoryIds).toEqual([1, 2, 3])
    expect(row?.error).toBeNull()

    expect(store.snapshot().has(1)).toBe(true)
    expect(aiText.calls).toHaveLength(1) // imageDescription was null → fallback used
    expect(aiImage.calls).toHaveLength(1)
  })

  it('uses the stored imageDescription verbatim when present (does not call AiTextPort)', async () => {
    const { pipeline, repo, aiText, aiImage } = createTestPipeline()

    await pipeline.submit({
      draft: {
        title: 'Test',
        description: 'desc',
        imageDescription: 'pre-baked prompt',
      },
      categoryIds: [],
    })

    expect(aiText.calls).toHaveLength(0)
    expect(aiImage.calls[0].prompt).toBe('pre-baked prompt')
    expect(repo.findRow(1)?.status).toBe(LogStatus.ImageGenerated)
  })

  it('records failed-recorded when linkCategories throws after a successful insert', async () => {
    const { pipeline, repo, store, aiImage } = createTestPipeline()
    const linkError = new Error('link table is down')
    repo.setLinkThrow(linkError)

    const result = await pipeline.submit({
      draft: { title: 'T', description: 'd', imageDescription: null },
      categoryIds: [9],
    })

    expect(result.id).toBe(1)
    expect(result.outcome).toEqual({ kind: 'failed-recorded', logId: 1, cause: linkError })
    const row = repo.findRow(1)
    expect(row?.status).toBe(LogStatus.Error)
    expect(row?.error).toBe('link table is down')
    // Image generation never ran when linkCategories threw.
    expect(aiImage.calls).toHaveLength(0)
    expect(store.snapshot().size).toBe(0)
  })

  it('records failed-recorded when AiImagePort.generateBase64 throws', async () => {
    const { pipeline, repo, aiImage, store } = createTestPipeline()
    const aiError = new Error('rate limit')
    aiImage.setThrow(aiError)

    const result = await pipeline.submit({
      draft: { title: 'T', description: 'd', imageDescription: 'cached' },
      categoryIds: [],
    })

    expect(result.outcome).toEqual({ kind: 'failed-recorded', logId: 1, cause: aiError })
    const row = repo.findRow(1)
    expect(row?.status).toBe(LogStatus.Error)
    expect(row?.error).toBe('rate limit')
    expect(store.snapshot().size).toBe(0)
  })

  it('unwraps Error.cause when surfacing the AI wrapper error', async () => {
    const { pipeline, repo, aiImage } = createTestPipeline()
    // Mirrors `services/imageGen.ts`: outer wrapper, real reason on `cause`.
    const inner = new Error('content_policy_violation')
    const wrapper = new Error('Image generation failed', { cause: inner })
    aiImage.setThrow(wrapper)

    await pipeline.submit({
      draft: { title: 'T', description: 'd', imageDescription: 'p' },
      categoryIds: [],
    })

    expect(repo.findRow(1)?.error).toBe('content_policy_violation')
  })

  it('records failed-recorded when AiTextPort returns ok:false (preserves AIError discriminator)', async () => {
    const { pipeline, repo, aiText, aiImage } = createTestPipeline()
    aiText.setResult({ ok: false, error: 'model', message: 'rate limit' })

    const result = await pipeline.submit({
      draft: { title: 'T', description: 'd', imageDescription: null },
      categoryIds: [],
    })

    expect(result.outcome.kind).toBe('failed-recorded')
    expect(repo.findRow(1)?.error).toBe('rate limit')
    expect(aiImage.calls).toHaveLength(0)
  })

  it('returns failed-write-also-failed when both generate and markError throw', async () => {
    const { pipeline, aiImage, repo } = createTestPipeline()
    const aiError = new Error('AI down')
    const writeError = new Error('db down')
    aiImage.setThrow(aiError)
    repo.setMarkErrorThrow(writeError)

    const result = await pipeline.submit({
      draft: { title: 'T', description: 'd', imageDescription: 'p' },
      categoryIds: [],
    })

    expect(result.outcome).toEqual({
      kind: 'failed-write-also-failed',
      logId: 1,
      cause: aiError,
      writeError,
    })
    // Status stays Created when markError itself failed.
    expect(repo.findRow(1)?.status).toBe(LogStatus.Created)
  })

  it('rejects to the caller when insertDraft itself throws (no row to record against)', async () => {
    const { pipeline, repo } = createTestPipeline()
    const insertError = new Error('insert exploded')
    repo.setInsertThrow(insertError)

    await expect(
      pipeline.submit({
        draft: { title: 'T', description: 'd', imageDescription: null },
        categoryIds: [],
      }),
    ).rejects.toBe(insertError)
    expect(repo.rows()).toHaveLength(0)
  })
})

describe('pipeline.generateImageFor', () => {
  it('returns success and marks ImageGenerated for a Created row', async () => {
    const { pipeline, repo, store } = createTestPipeline()
    repo.preload([
      { id: 7, description: 'd', imageDescription: 'cached', status: LogStatus.Created },
    ])

    const outcome = await pipeline.generateImageFor(7)

    expect(outcome).toEqual({ kind: 'success', logId: 7 })
    expect(repo.findRow(7)?.status).toBe(LogStatus.ImageGenerated)
    expect(store.snapshot().has(7)).toBe(true)
  })

  it('returns skipped:not-found when the row is absent', async () => {
    const { pipeline, store } = createTestPipeline()

    const outcome = await pipeline.generateImageFor(99)

    expect(outcome).toEqual({ kind: 'skipped', logId: 99, reason: 'not-found' })
    expect(store.snapshot().size).toBe(0)
  })

  it.each([
    LogStatus.ImageGenerated,
    LogStatus.Error,
  ])('returns skipped:not-pending for status=%s', async (status) => {
    const { pipeline, repo, store, aiImage } = createTestPipeline()
    repo.preload([{ id: 7, status }])

    const outcome = await pipeline.generateImageFor(7)

    expect(outcome).toEqual({ kind: 'skipped', logId: 7, reason: 'not-pending' })
    expect(aiImage.calls).toHaveLength(0)
    expect(store.snapshot().size).toBe(0)
  })

  it('records best-effort error when loadStatus throws (failed-recorded)', async () => {
    const { pipeline, repo } = createTestPipeline()
    const cause = new Error('libsql refused')
    repo.preload([{ id: 7, status: LogStatus.Created }])
    repo.setLoadStatusThrow(cause)

    const outcome = await pipeline.generateImageFor(7)

    expect(outcome).toEqual({ kind: 'failed-recorded', logId: 7, cause })
    expect(repo.findRow(7)?.status).toBe(LogStatus.Error)
    expect(repo.findRow(7)?.error).toBe('libsql refused')
  })

  it('returns failed-write-also-failed when loadStatus AND markError both throw', async () => {
    const { pipeline, repo } = createTestPipeline()
    const cause = new Error('libsql refused')
    const writeError = new Error('also broken')
    repo.preload([{ id: 7, status: LogStatus.Created }])
    repo.setLoadStatusThrow(cause)
    repo.setMarkErrorThrow(writeError)

    const outcome = await pipeline.generateImageFor(7)

    expect(outcome).toEqual({
      kind: 'failed-write-also-failed',
      logId: 7,
      cause,
      writeError,
    })
  })

  it('returns failed-recorded when markImageGenerated throws after a successful upload', async () => {
    const { pipeline, repo, store } = createTestPipeline()
    const writeError = new Error('mark failed')
    repo.preload([{ id: 7, description: 'd', imageDescription: 'p', status: LogStatus.Created }])
    repo.setMarkGeneratedThrow(writeError)

    const outcome = await pipeline.generateImageFor(7)

    expect(outcome).toEqual({ kind: 'failed-recorded', logId: 7, cause: writeError })
    // Image was uploaded — pre-existing leak behaviour preserved.
    expect(store.snapshot().has(7)).toBe(true)
    expect(repo.findRow(7)?.status).toBe(LogStatus.Error)
  })

  it('throws "Log not found" when the row vanishes between loadStatus and findById', async () => {
    // Hijack loadStatus to claim the row exists & is Created, while
    // the underlying repo storage knows nothing about id=42.
    const { repo } = createTestPipeline()
    const customRepo = {
      ...repo,
      loadStatus: async () => ({ status: LogStatus.Created }),
    }
    const { pipeline } = createTestPipeline({ repo: customRepo })

    const outcome = await pipeline.generateImageFor(42)

    expect(outcome.kind).toBe('failed-recorded')
    if (outcome.kind === 'failed-recorded') {
      expect((outcome.cause as Error).message).toBe('Log not found')
    }
  })
})

describe('pipeline.drainOnePending', () => {
  it('returns null when no Created rows exist', async () => {
    const { pipeline } = createTestPipeline()

    expect(await pipeline.drainOnePending()).toBeNull()
  })

  it('picks the lowest-id Created row and processes it', async () => {
    const { pipeline, repo } = createTestPipeline()
    repo.preload([
      { id: 5, status: LogStatus.ImageGenerated },
      { id: 6, status: LogStatus.Created, imageDescription: 'p' },
      { id: 7, status: LogStatus.Created, imageDescription: 'p' },
    ])

    const outcome = await pipeline.drainOnePending()

    expect(outcome).toEqual({ kind: 'success', logId: 6 })
    expect(repo.findRow(6)?.status).toBe(LogStatus.ImageGenerated)
    expect(repo.findRow(7)?.status).toBe(LogStatus.Created) // untouched
  })

  it('drains the entire queue across N+1 calls', async () => {
    const { pipeline, repo } = createTestPipeline()
    repo.preload([
      { id: 1, status: LogStatus.Created, imageDescription: 'p' },
      { id: 2, status: LogStatus.Created, imageDescription: 'p' },
      { id: 3, status: LogStatus.Created, imageDescription: 'p' },
    ])

    const o1 = await pipeline.drainOnePending()
    const o2 = await pipeline.drainOnePending()
    const o3 = await pipeline.drainOnePending()
    const o4 = await pipeline.drainOnePending()

    expect(o1).toEqual({ kind: 'success', logId: 1 })
    expect(o2).toEqual({ kind: 'success', logId: 2 })
    expect(o3).toEqual({ kind: 'success', logId: 3 })
    expect(o4).toBeNull()
  })

  it('returns the wrapped failed-recorded outcome when a per-row generation fails', async () => {
    const { pipeline, repo, aiImage } = createTestPipeline()
    repo.preload([{ id: 11, status: LogStatus.Created, imageDescription: 'p' }])
    const cause = new Error('AI down')
    aiImage.setThrow(cause)

    const outcome = await pipeline.drainOnePending()

    expect(outcome).toEqual({ kind: 'failed-recorded', logId: 11, cause })
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

describe('createImagePipeline (factory contract)', () => {
  it('exposes exactly three methods: submit, generateImageFor, drainOnePending', () => {
    const { pipeline } = createTestPipeline()
    expect(typeof pipeline.submit).toBe('function')
    expect(typeof pipeline.generateImageFor).toBe('function')
    expect(typeof pipeline.drainOnePending).toBe('function')
    // The legacy `run` method MUST be gone (FR-001).
    expect((pipeline as unknown as { run?: unknown }).run).toBeUndefined()
  })
})
