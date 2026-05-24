import { describe, expect, it, vi } from 'vitest'
import { LogStatus } from '@/data/enum/logStatus'
import * as pipelineModule from '@/services/imagePipeline'
import { logger } from '@/utils/logger'
import { createTestPipeline } from '../../tests/fakes/imagePipeline'

// Boundary suite. NO `vi.mock('@/drizzle')`,
// `vi.mock('@/services/imageGen')`, `vi.mock('@/services/storyForge')`,
// or `vi.mock('@/services/imageStore')` — the in-memory adapters from
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
    expect(result.report).toEqual({ status: 'success', logId: 1 })

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

  it('reports failed when linkCategories throws after a successful insert', async () => {
    const { pipeline, repo, store, aiImage, escalator } = createTestPipeline()
    const linkError = new Error('link table is down')
    repo.setLinkThrow(linkError)

    const result = await pipeline.submit({
      draft: { title: 'T', description: 'd', imageDescription: null },
      categoryIds: [9],
    })

    expect(result.id).toBe(1)
    expect(result.report).toEqual({
      status: 'failed',
      logId: 1,
      message: 'link table is down',
    })
    const row = repo.findRow(1)
    expect(row?.status).toBe(LogStatus.Error)
    expect(row?.error).toBe('link table is down')
    // Image generation never ran when linkCategories threw.
    expect(aiImage.calls).toHaveLength(0)
    expect(store.snapshot().size).toBe(0)
    // First-write succeeded → escalator MUST NOT be paged.
    expect(escalator.calls).toHaveLength(0)
  })

  it('reports failed when AiImagePort.generateBase64 throws', async () => {
    const { pipeline, repo, aiImage, store } = createTestPipeline()
    const aiError = new Error('rate limit')
    aiImage.setThrow(aiError)

    const result = await pipeline.submit({
      draft: { title: 'T', description: 'd', imageDescription: 'cached' },
      categoryIds: [],
    })

    expect(result.report).toEqual({ status: 'failed', logId: 1, message: 'rate limit' })
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

  it('reports failed when AiTextPort returns ok:false (preserves AIError discriminator)', async () => {
    const { pipeline, repo, aiText, aiImage } = createTestPipeline()
    aiText.setResult({ ok: false, error: 'model', message: 'rate limit' })

    const result = await pipeline.submit({
      draft: { title: 'T', description: 'd', imageDescription: null },
      categoryIds: [],
    })

    expect(result.report.status).toBe('failed')
    expect(repo.findRow(1)?.error).toBe('rate limit')
    expect(aiImage.calls).toHaveLength(0)
  })

  it('pages the escalator when both generate and markError throw (write-also-failed)', async () => {
    const { pipeline, aiImage, repo, escalator } = createTestPipeline()
    const aiError = new Error('AI down')
    const writeError = new Error('db down')
    aiImage.setThrow(aiError)
    repo.setMarkErrorThrow(writeError)

    const result = await pipeline.submit({
      draft: { title: 'T', description: 'd', imageDescription: 'p' },
      categoryIds: [],
    })

    // External surface collapses to plain `failed`.
    expect(result.report).toEqual({
      status: 'failed',
      logId: 1,
      message: 'AI down',
    })
    // The internal write-also-failed branch fires the escalator.
    expect(escalator.calls).toEqual([{ logId: 1, message: 'AI down', writeError: 'db down' }])
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
  it('returns status:success and marks ImageGenerated for a Created row', async () => {
    const { pipeline, repo, store } = createTestPipeline()
    repo.preload([
      { id: 7, description: 'd', imageDescription: 'cached', status: LogStatus.Created },
    ])

    const report = await pipeline.generateImageFor(7)

    expect(report).toEqual({ status: 'success', logId: 7 })
    expect(repo.findRow(7)?.status).toBe(LogStatus.ImageGenerated)
    expect(store.snapshot().has(7)).toBe(true)
  })

  it('returns status:skipped reason:not-found when the row is absent', async () => {
    const { pipeline, store } = createTestPipeline()

    const report = await pipeline.generateImageFor(99)

    expect(report).toEqual({ status: 'skipped', logId: 99, reason: 'not-found' })
    expect(store.snapshot().size).toBe(0)
  })

  it('falls back to AiTextPort when imageDescription is an empty string (truthiness gate, not null-check)', async () => {
    // FR-008 says "use imageDescription when non-empty". Truthiness gate
    // catches both `null` and `""`. A regression to `!== null` would feed
    // an empty prompt into the image model.
    const { pipeline, repo, aiText } = createTestPipeline()
    repo.preload([
      { id: 7, description: 'haunted teapot', imageDescription: '', status: LogStatus.Created },
    ])

    const report = await pipeline.generateImageFor(7)

    expect(report).toEqual({ status: 'success', logId: 7 })
    expect(aiText.calls).toHaveLength(1)
    expect(aiText.calls[0].description).toBe('haunted teapot')
  })

  it.each([
    LogStatus.ImageGenerated,
    LogStatus.Error,
  ])('returns status:skipped reason:not-pending for status=%s', async (status) => {
    const { pipeline, repo, store, aiImage } = createTestPipeline()
    repo.preload([{ id: 7, status }])

    const report = await pipeline.generateImageFor(7)

    expect(report).toEqual({ status: 'skipped', logId: 7, reason: 'not-pending' })
    expect(aiImage.calls).toHaveLength(0)
    expect(store.snapshot().size).toBe(0)
  })

  it('records best-effort error when loadStatus throws (reports failed)', async () => {
    const { pipeline, repo, escalator } = createTestPipeline()
    const cause = new Error('libsql refused')
    repo.preload([{ id: 7, status: LogStatus.Created }])
    repo.setLoadStatusThrow(cause)

    const report = await pipeline.generateImageFor(7)

    expect(report).toEqual({ status: 'failed', logId: 7, message: 'libsql refused' })
    expect(repo.findRow(7)?.status).toBe(LogStatus.Error)
    expect(repo.findRow(7)?.error).toBe('libsql refused')
    // Recovery write succeeded → escalator stays silent.
    expect(escalator.calls).toHaveLength(0)
  })

  it('pages the escalator when loadStatus AND markError both throw', async () => {
    const { pipeline, repo, escalator } = createTestPipeline()
    const cause = new Error('libsql refused')
    const writeError = new Error('also broken')
    repo.preload([{ id: 7, status: LogStatus.Created }])
    repo.setLoadStatusThrow(cause)
    repo.setMarkErrorThrow(writeError)

    const report = await pipeline.generateImageFor(7)

    expect(report).toEqual({ status: 'failed', logId: 7, message: 'libsql refused' })
    expect(escalator.calls).toEqual([
      { logId: 7, message: 'libsql refused', writeError: 'also broken' },
    ])
  })

  it('reports failed when markImageGenerated throws after a successful upload', async () => {
    const { pipeline, repo, store } = createTestPipeline()
    const writeError = new Error('mark failed')
    repo.preload([{ id: 7, description: 'd', imageDescription: 'p', status: LogStatus.Created }])
    repo.setMarkGeneratedThrow(writeError)

    const report = await pipeline.generateImageFor(7)

    expect(report).toEqual({ status: 'failed', logId: 7, message: 'mark failed' })
    // Image was uploaded — pre-existing leak behaviour preserved.
    expect(store.snapshot().has(7)).toBe(true)
    expect(repo.findRow(7)?.status).toBe(LogStatus.Error)
  })

  it('reports failed with "Log not found" when the row vanishes between loadStatus and findById', async () => {
    // Hijack loadStatus to claim the row exists & is Created, while
    // the underlying repo storage knows nothing about id=42.
    const { repo } = createTestPipeline()
    const customRepo = {
      ...repo,
      loadStatus: async () => ({ status: LogStatus.Created }),
    }
    const { pipeline } = createTestPipeline({ repo: customRepo })

    const report = await pipeline.generateImageFor(42)

    expect(report).toEqual({ status: 'failed', logId: 42, message: 'Log not found' })
  })

  it('emits an info log line on skipped outcomes', async () => {
    const { pipeline } = createTestPipeline()
    vi.mocked(logger.info).mockClear()

    await pipeline.generateImageFor(99)

    expect(vi.mocked(logger.info)).toHaveBeenCalledWith('imagePipeline: skipped log 99 (not-found)')
  })

  it('emits an error log line on failed-recorded', async () => {
    const { pipeline, repo, aiImage } = createTestPipeline()
    repo.preload([{ id: 7, status: LogStatus.Created, imageDescription: 'p' }])
    const cause = new Error('AI down')
    aiImage.setThrow(cause)
    vi.mocked(logger.error).mockClear()

    await pipeline.generateImageFor(7)

    expect(vi.mocked(logger.error)).toHaveBeenCalledWith(
      'imagePipeline: recorded an error for log 7',
      { cause },
    )
  })
})

describe('pipeline.drain', () => {
  it('returns processed:0 / failed:0 when no Created rows exist', async () => {
    const { pipeline } = createTestPipeline()

    expect(await pipeline.drain()).toEqual({ processed: 0, failed: 0 })
  })

  it('drains the entire queue across N rows', async () => {
    const { pipeline, repo } = createTestPipeline()
    repo.preload([
      { id: 5, status: LogStatus.ImageGenerated },
      { id: 6, status: LogStatus.Created, imageDescription: 'p' },
      { id: 7, status: LogStatus.Created, imageDescription: 'p' },
    ])

    const summary = await pipeline.drain()

    expect(summary).toEqual({ processed: 2, failed: 0 })
    expect(repo.findRow(6)?.status).toBe(LogStatus.ImageGenerated)
    expect(repo.findRow(7)?.status).toBe(LogStatus.ImageGenerated)
  })

  it('counts failed rows in the summary and keeps draining', async () => {
    const { pipeline, repo, aiImage } = createTestPipeline()
    repo.preload([
      { id: 1, status: LogStatus.Created, imageDescription: 'p' },
      { id: 2, status: LogStatus.Created, imageDescription: 'p' },
    ])
    aiImage.setThrow(new Error('AI down'))

    const summary = await pipeline.drain()
    // Both rows get marked Error (markError works), so both report failed.
    expect(summary).toEqual({ processed: 2, failed: 2 })
    expect(repo.findRow(1)?.status).toBe(LogStatus.Error)
    expect(repo.findRow(2)?.status).toBe(LogStatus.Error)
  })

  it('counts a racing skipped outcome as processed but not failed', async () => {
    // Models the FR-009 / spec clarification race: another caller marked
    // the row ImageGenerated after findFirstPending picked it up but
    // before loadStatus ran. drain MUST still tick the counter so the
    // queue exhausts.
    const { repo } = createTestPipeline()
    repo.preload([{ id: 4, status: LogStatus.Created, imageDescription: 'p' }])
    let calls = 0
    const racingRepo = {
      ...repo,
      loadStatus: async () => ({ status: LogStatus.ImageGenerated }),
      findFirstPending: async () => {
        calls++
        return calls === 1 ? { id: 4 } : null
      },
    }
    const { pipeline } = createTestPipeline({ repo: racingRepo })

    const summary = await pipeline.drain()

    expect(summary).toEqual({ processed: 1, failed: 0 })
  })
})

describe('public export surface', () => {
  it('does NOT re-export PipelineOutcome / logPipelineOutcome / NO_FAILURE / causeToErrorString', () => {
    // The internal 4-kind discriminator and its helpers MUST stay private.
    const mod = pipelineModule as Record<string, unknown>
    expect(mod.PipelineOutcome).toBeUndefined()
    expect(mod.logPipelineOutcome).toBeUndefined()
    expect(mod.NO_FAILURE).toBeUndefined()
    expect(mod.causeToErrorString).toBeUndefined()
  })

  it('exposes imagePipeline + createImagePipeline + createDefaultImagePipeline', () => {
    const mod = pipelineModule as Record<string, unknown>
    expect(mod.imagePipeline).toBeDefined()
    expect(typeof mod.createImagePipeline).toBe('function')
    expect(typeof mod.createDefaultImagePipeline).toBe('function')
  })
})

describe('createImagePipeline (factory contract)', () => {
  it('exposes exactly three methods: submit, generateImageFor, drain', () => {
    const { pipeline } = createTestPipeline()
    expect(typeof pipeline.submit).toBe('function')
    expect(typeof pipeline.generateImageFor).toBe('function')
    expect(typeof pipeline.drain).toBe('function')
    // The legacy `drainOnePending` and `run` methods MUST be gone.
    expect((pipeline as unknown as { drainOnePending?: unknown }).drainOnePending).toBeUndefined()
    expect((pipeline as unknown as { run?: unknown }).run).toBeUndefined()
  })
})
