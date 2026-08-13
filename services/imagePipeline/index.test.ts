import { describe, expect, it, vi } from 'vitest'
import { LogStatus } from '@/data/enum/logStatus'
import * as pipelineModule from '@/services/imagePipeline'
import { logger } from '@/utils/logger'
import { createTestPipeline } from '../../tests/fakes/imagePipeline'
import { MAX_ATTEMPTS, SWEEP_STALE_MS } from './config'

// Boundary suite. NO `vi.mock('@/drizzle')`,
// `vi.mock('@/services/imageGen')`, `vi.mock('@/services/storyForge')`,
// or `vi.mock('@/services/imageStore')` — the in-memory adapters from
// `tests/fakes/imagePipeline.ts` replace those at the port level.
//
// Generation now runs from the queue consumer, so `generateImageFor` is
// exercised directly here and the delivery context (`deliveryAttempt`) stands
// in for what Cloudflare would pass.

// A fixed clock keeps sweeper cutoffs exact instead of racing the wall clock.
const NOW = 1_000_000
const fixedClock = { now: () => NOW }

describe('pipeline.submit', () => {
  it('inserts a draft, links categories and enqueues WITHOUT generating inline', async () => {
    const { pipeline, repo, store, aiText, aiImage, queue } = createTestPipeline()

    const result = await pipeline.submit({
      draft: {
        title: 'A whisper at midnight',
        description: 'The kitten knocked over a candle',
        imageDescription: null,
      },
      categoryIds: [1, 2, 3],
    })

    expect(result).toEqual({ id: 1, enqueued: true })

    const row = repo.findRow(1)
    expect(row?.status).toBe(LogStatus.Created)
    expect(row?.categoryIds).toEqual([1, 2, 3])
    expect(row?.error).toBeNull()
    expect(row?.attempts).toBe(0)

    expect(queue.sent).toEqual([{ v: 1, logId: 1, source: 'submit' }])
    // The whole point of the change: no model call, no upload, in-request.
    expect(aiText.calls).toHaveLength(0)
    expect(aiImage.calls).toHaveLength(0)
    expect(store.snapshot().size).toBe(0)
  })

  it('returns enqueued:false and keeps the row pending when the queue write fails', async () => {
    const { pipeline, repo, queue } = createTestPipeline()
    queue.setSendThrow(new Error('queues down'))
    vi.mocked(logger.error).mockClear()

    const result = await pipeline.submit({
      draft: { title: 'T', description: 'd', imageDescription: null },
      categoryIds: [],
    })

    expect(result).toEqual({
      id: 1,
      enqueued: false,
      message: 'Failed to enqueue image generation',
    })
    // Recoverable, NOT an error state: the sweeper picks this row up.
    const row = repo.findRow(1)
    expect(row?.status).toBe(LogStatus.Created)
    expect(row?.error).toBeNull()
    expect(vi.mocked(logger.error)).toHaveBeenCalled()
  })

  it('records a terminal error and does not enqueue when linkCategories throws', async () => {
    const { pipeline, repo, queue, escalator } = createTestPipeline()
    repo.setLinkThrow(new Error('link table is down'))

    const result = await pipeline.submit({
      draft: { title: 'T', description: 'd', imageDescription: null },
      categoryIds: [9],
    })

    expect(result).toEqual({ id: 1, enqueued: false, message: 'link table is down' })
    const row = repo.findRow(1)
    expect(row?.status).toBe(LogStatus.Error)
    expect(row?.error).toBe('link table is down')
    expect(queue.sent).toHaveLength(0)
    // First-write succeeded → escalator MUST NOT be paged.
    expect(escalator.calls).toHaveLength(0)
  })

  it('pages the escalator when linkCategories AND markError both throw', async () => {
    const { pipeline, repo, escalator } = createTestPipeline()
    repo.setLinkThrow(new Error('link down'))
    repo.setMarkErrorThrow(new Error('db down'))

    const result = await pipeline.submit({
      draft: { title: 'T', description: 'd', imageDescription: null },
      categoryIds: [9],
    })

    expect(result.enqueued).toBe(false)
    expect(escalator.calls).toEqual([{ logId: 1, message: 'link down', writeError: 'db down' }])
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
  it('claims the row, generates, and marks ImageGenerated', async () => {
    const { pipeline, repo, store } = createTestPipeline()
    repo.preload([
      { id: 7, description: 'd', imageDescription: 'cached', status: LogStatus.Created },
    ])

    const report = await pipeline.generateImageFor(7)

    expect(report).toEqual({ status: 'success', logId: 7 })
    const row = repo.findRow(7)
    expect(row?.status).toBe(LogStatus.ImageGenerated)
    // The claim consumed one attempt even though it succeeded — free
    // diagnostics for "this log needed two tries".
    expect(row?.attempts).toBe(1)
    expect(store.snapshot().has(7)).toBe(true)
  })

  it('clears a stale error when a retried attempt finally succeeds', async () => {
    const { pipeline, repo } = createTestPipeline()
    repo.preload([
      {
        id: 7,
        imageDescription: 'p',
        status: LogStatus.Created,
        attempts: 1,
        error: 'previous transient failure',
      },
    ])

    await pipeline.generateImageFor(7, { deliveryAttempt: 2 })

    expect(repo.findRow(7)?.error).toBeNull()
  })

  it('uses the stored imageDescription verbatim when present', async () => {
    const { pipeline, repo, aiText, aiImage } = createTestPipeline()
    repo.preload([{ id: 7, imageDescription: 'pre-baked prompt', status: LogStatus.Created }])

    await pipeline.generateImageFor(7)

    expect(aiText.calls).toHaveLength(0)
    expect(aiImage.calls[0].prompt).toBe('pre-baked prompt')
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

  it('returns status:skipped reason:not-found when the row is absent', async () => {
    const { pipeline, store } = createTestPipeline()

    const report = await pipeline.generateImageFor(99)

    expect(report).toEqual({ status: 'skipped', logId: 99, reason: 'not-found' })
    expect(store.snapshot().size).toBe(0)
  })

  it.each([LogStatus.ImageGenerated, LogStatus.Error])(
    'returns status:skipped reason:not-pending for status=%s',
    async (status) => {
      const { pipeline, repo, store, aiImage } = createTestPipeline()
      repo.preload([{ id: 7, status }])

      const report = await pipeline.generateImageFor(7)

      expect(report).toEqual({ status: 'skipped', logId: 7, reason: 'not-pending' })
      expect(aiImage.calls).toHaveLength(0)
      expect(store.snapshot().size).toBe(0)
    },
  )

  it('never spends money on a row whose attempt budget is already gone', async () => {
    // The claim is refused, so this is the duplicate-message case: a second
    // delivery for a row that has already burned MAX_ATTEMPTS.
    const { pipeline, repo, aiImage } = createTestPipeline()
    repo.preload([{ id: 7, status: LogStatus.Created, attempts: MAX_ATTEMPTS }])

    const report = await pipeline.generateImageFor(7)

    expect(aiImage.calls).toHaveLength(0)
    expect(report.status).toBe('failed')
    expect(report.retryable).toBe(false)
    // The row would otherwise sit pending forever, so make it terminal here.
    const row = repo.findRow(7)
    expect(row?.status).toBe(LogStatus.Error)
    expect(row?.error).toBe(`Image generation gave up after ${MAX_ATTEMPTS} attempts`)
  })

  it('leaves the row pending and reports retryable on the first transient failure', async () => {
    const { pipeline, repo, aiImage, escalator } = createTestPipeline()
    repo.preload([{ id: 7, imageDescription: 'p', status: LogStatus.Created }])
    aiImage.setThrow(new Error('rate limit'))

    const report = await pipeline.generateImageFor(7, { deliveryAttempt: 1 })

    expect(report).toEqual({
      status: 'failed',
      logId: 7,
      message: 'rate limit',
      retryable: true,
    })
    const row = repo.findRow(7)
    // Pending is load-bearing: the redelivered message has to be able to claim
    // attempt 2, and a status of `Error` would make it a silent no-op.
    expect(row?.status).toBe(LogStatus.Created)
    expect(row?.attempts).toBe(1)
    // No `error` written mid-cycle: the UI renders `Created` as "generating",
    // and a row that reads as failed while showing a spinner is a lie.
    expect(row?.error).toBeNull()
    expect(escalator.calls).toHaveLength(0)
  })

  it('records a terminal error once the budget is spent', async () => {
    const { pipeline, repo, aiImage } = createTestPipeline()
    repo.preload([{ id: 7, imageDescription: 'p', status: LogStatus.Created, attempts: 1 }])
    aiImage.setThrow(new Error('rate limit'))

    const report = await pipeline.generateImageFor(7, { deliveryAttempt: 2 })

    expect(report).toEqual({
      status: 'failed',
      logId: 7,
      message: 'rate limit',
      retryable: false,
    })
    const row = repo.findRow(7)
    expect(row?.status).toBe(LogStatus.Error)
    expect(row?.error).toBe('rate limit')
    expect(row?.attempts).toBe(2)
  })

  it('treats the last allowed delivery as final even if the attempts counter lags', async () => {
    // Belt-and-braces: if the durable counter ever fails to advance, the
    // per-message delivery count still terminates the job.
    const { pipeline, repo, aiImage } = createTestPipeline()
    repo.preload([{ id: 7, imageDescription: 'p', status: LogStatus.Created }])
    aiImage.setThrow(new Error('rate limit'))

    const report = await pipeline.generateImageFor(7, { deliveryAttempt: 2 })

    expect(report.retryable).toBe(false)
    expect(repo.findRow(7)?.status).toBe(LogStatus.Error)
  })

  it('honours an explicit final:true', async () => {
    const { pipeline, repo, aiImage } = createTestPipeline()
    repo.preload([{ id: 7, imageDescription: 'p', status: LogStatus.Created }])
    aiImage.setThrow(new Error('rate limit'))

    const report = await pipeline.generateImageFor(7, { deliveryAttempt: 1, final: true })

    expect(report.retryable).toBe(false)
    expect(repo.findRow(7)?.status).toBe(LogStatus.Error)
  })

  it('records a terminal error when the claim itself throws', async () => {
    const { pipeline, repo, escalator } = createTestPipeline()
    repo.preload([{ id: 7, status: LogStatus.Created }])
    repo.setClaimThrow(new Error('libsql refused'))

    const report = await pipeline.generateImageFor(7)

    // No budget information available, so granting more redeliveries could
    // loop forever.
    expect(report).toEqual({
      status: 'failed',
      logId: 7,
      message: 'libsql refused',
      retryable: false,
    })
    expect(repo.findRow(7)?.status).toBe(LogStatus.Error)
    expect(escalator.calls).toHaveLength(0)
  })

  it('pages the escalator when the claim AND markError both throw', async () => {
    const { pipeline, repo, escalator } = createTestPipeline()
    repo.preload([{ id: 7, status: LogStatus.Created }])
    repo.setClaimThrow(new Error('libsql refused'))
    repo.setMarkErrorThrow(new Error('also broken'))

    const report = await pipeline.generateImageFor(7)

    expect(report.status).toBe('failed')
    expect(escalator.calls).toEqual([
      { logId: 7, message: 'libsql refused', writeError: 'also broken' },
    ])
  })

  it('skips (and does not generate) when loadState throws for an unclaimed row', async () => {
    const { repo } = createTestPipeline()
    const customRepo = {
      ...repo,
      claim: async () => null,
      loadState: async () => {
        throw new Error('libsql refused')
      },
    }
    const { pipeline, aiImage } = createTestPipeline({ repo: customRepo })

    const report = await pipeline.generateImageFor(7)

    // Acked by the consumer; the row (if pending) stays visible to the sweeper.
    expect(report).toEqual({ status: 'skipped', logId: 7, reason: 'not-pending' })
    expect(aiImage.calls).toHaveLength(0)
  })

  it('reports failed when markImageGenerated throws after a successful upload', async () => {
    const { pipeline, repo, store } = createTestPipeline()
    repo.preload([{ id: 7, description: 'd', imageDescription: 'p', status: LogStatus.Created }])
    repo.setMarkGeneratedThrow(new Error('mark failed'))

    const report = await pipeline.generateImageFor(7, { deliveryAttempt: 1 })

    expect(report.message).toBe('mark failed')
    // Image was uploaded — pre-existing leak behaviour preserved. The retry
    // overwrites the same R2 key, so there is no orphan to clean up.
    expect(store.snapshot().has(7)).toBe(true)
    expect(repo.findRow(7)?.status).toBe(LogStatus.Created)
  })

  it('emits an info log line on skipped outcomes', async () => {
    const { pipeline } = createTestPipeline()
    vi.mocked(logger.info).mockClear()

    await pipeline.generateImageFor(99)

    expect(vi.mocked(logger.info)).toHaveBeenCalledWith('imagePipeline: skipped log 99 (not-found)')
  })

  it('warns (not errors) on a retryable attempt failure', async () => {
    const { pipeline, repo, aiImage } = createTestPipeline()
    repo.preload([{ id: 7, status: LogStatus.Created, imageDescription: 'p' }])
    const cause = new Error('AI down')
    aiImage.setThrow(cause)
    vi.mocked(logger.warn).mockClear()

    await pipeline.generateImageFor(7, { deliveryAttempt: 1 })

    expect(vi.mocked(logger.warn)).toHaveBeenCalledWith(
      `imagePipeline: attempt 1/${MAX_ATTEMPTS} failed for log 7, leaving it pending for redelivery`,
      { cause },
    )
  })

  it('emits an error log line on failed-recorded', async () => {
    const { pipeline, repo, aiImage } = createTestPipeline()
    repo.preload([{ id: 7, status: LogStatus.Created, imageDescription: 'p', attempts: 1 }])
    const cause = new Error('AI down')
    aiImage.setThrow(cause)
    vi.mocked(logger.error).mockClear()

    await pipeline.generateImageFor(7, { deliveryAttempt: 2 })

    expect(vi.mocked(logger.error)).toHaveBeenCalledWith(
      'imagePipeline: recorded an error for log 7',
      { cause },
    )
  })
})

describe('retryability classification', () => {
  // Every case below fails on attempt 1 of 2, so the ONLY thing deciding
  // whether the row stays pending is the classifier.
  const failWith = async (cause: unknown) => {
    const { pipeline, repo, aiImage } = createTestPipeline()
    repo.preload([{ id: 7, imageDescription: 'p', status: LogStatus.Created }])
    aiImage.setThrow(cause)
    const report = await pipeline.generateImageFor(7, { deliveryAttempt: 1 })
    return { report, row: repo.findRow(7) }
  }

  it('retries a rate limit', async () => {
    const { report, row } = await failWith(new Error('429 rate limit exceeded'))
    expect(report.retryable).toBe(true)
    expect(row?.status).toBe(LogStatus.Created)
  })

  it('retries an R2 upload failure', async () => {
    const { report } = await failWith(new Error('R2 upload failed: internal error'))
    expect(report.retryable).toBe(true)
  })

  it('retries an unrecognised non-Error rejection', async () => {
    const { report } = await failWith('something odd')
    expect(report.retryable).toBe(true)
  })

  it('does NOT retry a content-policy refusal', async () => {
    const { report, row } = await failWith(
      new Error('Image generation failed', { cause: new Error('content_policy_violation') }),
    )
    expect(report.retryable).toBe(false)
    expect(row?.status).toBe(LogStatus.Error)
    // The inner cause is what gets persisted, not the wrapper.
    expect(row?.error).toBe('content_policy_violation')
  })

  it('does NOT retry a storyForge validation failure', async () => {
    const { pipeline, repo, aiText, aiImage } = createTestPipeline()
    repo.preload([{ id: 7, description: 'd', imageDescription: null, status: LogStatus.Created }])
    aiText.setResult({ ok: false, error: 'validation', message: 'blank prompt' })

    const report = await pipeline.generateImageFor(7, { deliveryAttempt: 1 })

    expect(report.retryable).toBe(false)
    expect(repo.findRow(7)?.status).toBe(LogStatus.Error)
    expect(repo.findRow(7)?.error).toBe('blank prompt')
    expect(aiImage.calls).toHaveLength(0)
  })

  it('DOES retry a storyForge model failure', async () => {
    const { pipeline, repo, aiText } = createTestPipeline()
    repo.preload([{ id: 7, description: 'd', imageDescription: null, status: LogStatus.Created }])
    aiText.setResult({ ok: false, error: 'model', message: 'upstream 503' })

    const report = await pipeline.generateImageFor(7, { deliveryAttempt: 1 })

    expect(report.retryable).toBe(true)
    expect(repo.findRow(7)?.status).toBe(LogStatus.Created)
  })

  it.each([400, 403, 404, 422])('does NOT retry an HTTP %s from the provider', async (status) => {
    const inner = Object.assign(new Error('bad request'), { statusCode: status })
    const { report } = await failWith(new Error('Image generation failed', { cause: inner }))
    expect(report.retryable).toBe(false)
  })

  it('DOES retry an HTTP 503 from the provider', async () => {
    const inner = Object.assign(new Error('service unavailable'), { statusCode: 503 })
    const { report } = await failWith(new Error('Image generation failed', { cause: inner }))
    expect(report.retryable).toBe(true)
  })

  it('does NOT retry a vanished row', async () => {
    const { repo } = createTestPipeline()
    const customRepo = { ...repo, claim: async () => ({ attempt: 1 }) }
    const { pipeline } = createTestPipeline({ repo: customRepo })

    const report = await pipeline.generateImageFor(42, { deliveryAttempt: 1 })

    expect(report.message).toBe('Log not found')
    expect(report.retryable).toBe(false)
  })
})

describe('pipeline.enqueue', () => {
  it('sends a versioned job and returns true', async () => {
    const { pipeline, queue } = createTestPipeline()

    await expect(pipeline.enqueue(7, 'update')).resolves.toBe(true)
    expect(queue.sent).toEqual([{ v: 1, logId: 7, source: 'update' }])
  })

  it('returns false and logs instead of throwing when the queue is down', async () => {
    const { pipeline, queue } = createTestPipeline()
    queue.setSendThrow(new Error('queues down'))
    vi.mocked(logger.error).mockClear()

    await expect(pipeline.enqueue(7, 'update')).resolves.toBe(false)
    expect(vi.mocked(logger.error)).toHaveBeenCalled()
  })
})

describe('pipeline.retry', () => {
  it('resets an Error row to Created with a fresh budget and enqueues it', async () => {
    const { pipeline, repo, queue } = createTestPipeline()
    repo.preload([
      { id: 7, status: LogStatus.Error, attempts: MAX_ATTEMPTS, error: 'content policy' },
    ])

    const result = await pipeline.retry(7)

    expect(result).toEqual({ requeued: true, enqueued: true })
    const row = repo.findRow(7)
    expect(row?.status).toBe(LogStatus.Created)
    expect(row?.attempts).toBe(0)
    expect(row?.error).toBeNull()
    expect(queue.sent).toEqual([{ v: 1, logId: 7, source: 'retry' }])
  })

  it('reports requeued:false for a row that does not exist', async () => {
    const { pipeline, queue } = createTestPipeline()

    expect(await pipeline.retry(99)).toEqual({ requeued: false, enqueued: false })
    expect(queue.sent).toHaveLength(0)
  })

  it('reports the enqueue failure separately from the requeue', async () => {
    const { pipeline, repo, queue } = createTestPipeline()
    repo.preload([{ id: 7, status: LogStatus.Error }])
    queue.setSendThrow(new Error('queues down'))

    expect(await pipeline.retry(7)).toEqual({ requeued: true, enqueued: false })
    // Still recoverable by the sweeper, because the row is pending again.
    expect(repo.findRow(7)?.status).toBe(LogStatus.Created)
  })
})

describe('pipeline.enqueuePending', () => {
  it('returns processed:0 and leaves the queue untouched when nothing is pending', async () => {
    const { pipeline, repo, queue } = createTestPipeline()
    repo.preload([{ id: 1, status: LogStatus.ImageGenerated }])

    expect(await pipeline.enqueuePending()).toEqual({ processed: 0 })
    expect(queue.batches).toHaveLength(0)
  })

  it('enqueues every pending row in ONE batch and renews their leases', async () => {
    const { pipeline, repo, queue } = createTestPipeline({}, fixedClock)
    repo.preload([
      { id: 1, status: LogStatus.Created, updatedAt: 0 },
      { id: 2, status: LogStatus.ImageGenerated, updatedAt: 0 },
      { id: 3, status: LogStatus.Created, updatedAt: 0 },
    ])

    expect(await pipeline.enqueuePending()).toEqual({ processed: 2 })
    expect(queue.batches).toHaveLength(1)
    expect(queue.batches[0]).toEqual([
      { v: 1, logId: 1, source: 'script' },
      { v: 1, logId: 3, source: 'script' },
    ])
    expect(repo.findRow(1)?.updatedAt).toBe(NOW)
    expect(repo.findRow(3)?.updatedAt).toBe(NOW)
  })

  it('honours the cap', async () => {
    const { pipeline, repo } = createTestPipeline()
    repo.preload([1, 2, 3, 4, 5].map((id) => ({ id, status: LogStatus.Created })))

    expect(await pipeline.enqueuePending(2)).toEqual({ processed: 2 })
  })

  it('propagates a queue failure so the route reporter can surface it', async () => {
    const { pipeline, repo, queue } = createTestPipeline()
    repo.preload([{ id: 1, status: LogStatus.Created }])
    queue.setSendBatchThrow(new Error('queues down'))

    await expect(pipeline.enqueuePending()).rejects.toThrow('queues down')
  })
})

describe('pipeline.sweep', () => {
  const stale = NOW - SWEEP_STALE_MS - 1

  it('reports an empty summary when nothing is stale', async () => {
    const { pipeline, repo, queue } = createTestPipeline({}, fixedClock)
    repo.preload([{ id: 1, status: LogStatus.Created, updatedAt: NOW }])

    expect(await pipeline.sweep({ now: NOW })).toEqual({
      scanned: 0,
      requeued: 0,
      abandoned: 0,
      failed: 0,
    })
    expect(queue.batches).toHaveLength(0)
  })

  it('treats a row exactly at the cutoff as fresh (strict comparison)', async () => {
    const { pipeline, repo } = createTestPipeline({}, fixedClock)
    repo.preload([{ id: 1, status: LogStatus.Created, updatedAt: NOW - SWEEP_STALE_MS }])

    expect((await pipeline.sweep({ now: NOW })).scanned).toBe(0)
  })

  it('never scans rows that are not pending', async () => {
    const { pipeline, repo } = createTestPipeline({}, fixedClock)
    repo.preload([
      { id: 1, status: LogStatus.ImageGenerated, updatedAt: stale },
      { id: 2, status: LogStatus.Error, updatedAt: stale },
    ])

    expect((await pipeline.sweep({ now: NOW })).scanned).toBe(0)
  })

  it('re-enqueues a stale row that still has budget and renews its lease', async () => {
    const { pipeline, repo, queue } = createTestPipeline({}, fixedClock)
    repo.preload([{ id: 7, status: LogStatus.Created, attempts: 1, updatedAt: stale }])

    expect(await pipeline.sweep({ now: NOW })).toEqual({
      scanned: 1,
      requeued: 1,
      abandoned: 0,
      failed: 0,
    })
    expect(queue.sent).toEqual([{ v: 1, logId: 7, source: 'sweeper' }])
    const row = repo.findRow(7)
    expect(row?.status).toBe(LogStatus.Created)
    // Lease renewed, so the next tick does not re-enqueue the same row while
    // this message is still in flight.
    expect(row?.updatedAt).toBe(NOW)
  })

  it('abandons a stale row whose budget is spent instead of re-enqueueing it', async () => {
    const { pipeline, repo, queue } = createTestPipeline({}, fixedClock)
    repo.preload([{ id: 7, status: LogStatus.Created, attempts: MAX_ATTEMPTS, updatedAt: stale }])

    expect(await pipeline.sweep({ now: NOW })).toEqual({
      scanned: 1,
      requeued: 0,
      abandoned: 1,
      failed: 0,
    })
    expect(queue.sent).toHaveLength(0)
    const row = repo.findRow(7)
    expect(row?.status).toBe(LogStatus.Error)
    expect(row?.error).toBe(`Image generation gave up after ${MAX_ATTEMPTS} attempts`)
  })

  it('splits a mixed batch', async () => {
    const { pipeline, repo, queue } = createTestPipeline({}, fixedClock)
    repo.preload([
      { id: 1, status: LogStatus.Created, attempts: 0, updatedAt: stale },
      { id: 2, status: LogStatus.Created, attempts: MAX_ATTEMPTS, updatedAt: stale },
    ])

    expect(await pipeline.sweep({ now: NOW })).toEqual({
      scanned: 2,
      requeued: 1,
      abandoned: 1,
      failed: 0,
    })
    expect(queue.batches[0]).toEqual([{ v: 1, logId: 1, source: 'sweeper' }])
    expect(repo.findRow(2)?.status).toBe(LogStatus.Error)
  })

  it('honours the cap, oldest first', async () => {
    const { pipeline, repo, queue } = createTestPipeline({}, fixedClock)
    repo.preload([
      { id: 1, status: LogStatus.Created, updatedAt: stale },
      { id: 2, status: LogStatus.Created, updatedAt: stale - 100 },
      { id: 3, status: LogStatus.Created, updatedAt: stale - 200 },
    ])

    expect((await pipeline.sweep({ now: NOW, limit: 2 })).scanned).toBe(2)
    expect(queue.sent.map((job) => job.logId)).toEqual([3, 2])
  })

  it('counts a queue failure as failed and does NOT renew the lease', async () => {
    const { pipeline, repo, queue } = createTestPipeline({}, fixedClock)
    repo.preload([{ id: 7, status: LogStatus.Created, updatedAt: stale }])
    queue.setSendBatchThrow(new Error('queues down'))
    vi.mocked(logger.error).mockClear()

    expect(await pipeline.sweep({ now: NOW })).toEqual({
      scanned: 1,
      requeued: 0,
      abandoned: 0,
      failed: 1,
    })
    // Lease untouched, so the next tick tries again.
    expect(repo.findRow(7)?.updatedAt).toBe(stale)
    expect(vi.mocked(logger.error)).toHaveBeenCalled()
  })

  it('is idempotent across two consecutive runs at the same instant', async () => {
    const { pipeline, repo, queue } = createTestPipeline({}, fixedClock)
    repo.preload([{ id: 7, status: LogStatus.Created, updatedAt: stale }])

    await pipeline.sweep({ now: NOW })
    await pipeline.sweep({ now: NOW })

    // The lease renewal from the first run is what prevents the duplicate.
    expect(queue.sent).toHaveLength(1)
  })

  it('pages the escalator when abandoning a row cannot be written', async () => {
    const { pipeline, repo, escalator } = createTestPipeline({}, fixedClock)
    repo.preload([{ id: 7, status: LogStatus.Created, attempts: MAX_ATTEMPTS, updatedAt: stale }])
    repo.setMarkErrorThrow(new Error('db down'))

    await pipeline.sweep({ now: NOW })

    expect(escalator.calls).toHaveLength(1)
    expect(escalator.calls[0].writeError).toBe('db down')
  })
})

describe('pipeline.abandon', () => {
  it('marks a pending row Error', async () => {
    const { pipeline, repo } = createTestPipeline()
    repo.preload([{ id: 7, status: LogStatus.Created, attempts: 2 }])

    const report = await pipeline.abandon(7, 'dead-lettered')

    expect(report).toEqual({
      status: 'failed',
      logId: 7,
      message: 'dead-lettered',
      retryable: false,
    })
    expect(repo.findRow(7)?.error).toBe('dead-lettered')
  })

  it('never clobbers a row that succeeded in the meantime', async () => {
    const { pipeline, repo } = createTestPipeline()
    repo.preload([{ id: 7, status: LogStatus.ImageGenerated }])

    const report = await pipeline.abandon(7, 'dead-lettered')

    expect(report).toEqual({ status: 'skipped', logId: 7, reason: 'not-pending' })
    expect(repo.findRow(7)?.status).toBe(LogStatus.ImageGenerated)
    expect(repo.findRow(7)?.error).toBeNull()
  })

  it('never overwrites an already-recorded error', async () => {
    const { pipeline, repo } = createTestPipeline()
    repo.preload([{ id: 7, status: LogStatus.Error, error: 'the real reason' }])

    await pipeline.abandon(7, 'dead-lettered')

    expect(repo.findRow(7)?.error).toBe('the real reason')
  })

  it('cannot clobber a successful row even when it fails to read the state first', async () => {
    // The dangerous combination: `loadState` throws, so `abandon` has no idea
    // the row already succeeded, and goes ahead with the terminal write. The
    // repository's own `status = 'Created'` guard is what makes that harmless
    // — otherwise a transient read failure during a dead-letter hop would hide
    // a perfectly good cover behind an `Error` status.
    const { repo } = createTestPipeline()
    repo.preload([{ id: 7, status: LogStatus.ImageGenerated }])
    repo.setLoadStateThrow(new Error('libsql refused'))
    const { pipeline } = createTestPipeline({ repo })

    await pipeline.abandon(7, 'dead-lettered')

    const row = repo.findRow(7)
    expect(row?.status).toBe(LogStatus.ImageGenerated)
    expect(row?.error).toBeNull()
  })
})

describe('public export surface', () => {
  it('does NOT re-export PipelineOutcome / NO_FAILURE / causeToErrorString / isRetryable', () => {
    // The internal outcome discriminator and its helpers MUST stay private.
    const mod = pipelineModule as Record<string, unknown>
    expect(mod.PipelineOutcome).toBeUndefined()
    expect(mod.logPipelineOutcome).toBeUndefined()
    expect(mod.NO_FAILURE).toBeUndefined()
    expect(mod.causeToErrorString).toBeUndefined()
    expect(mod.isRetryable).toBeUndefined()
    // Tuning knobs live in `./config`; importing them from the barrel would
    // let a caller drift from the wrangler-side numbers.
    expect(mod.MAX_ATTEMPTS).toBeUndefined()
    expect(mod.RETRY_DELAY_SECONDS).toBeUndefined()
  })

  it('exposes the pipeline, its factories and the queue helpers', () => {
    const mod = pipelineModule as Record<string, unknown>
    expect(mod.imagePipeline).toBeDefined()
    expect(typeof mod.createImagePipeline).toBe('function')
    expect(typeof mod.createDefaultImagePipeline).toBe('function')
    expect(typeof mod.createQueueProducer).toBe('function')
    expect(typeof mod.createQueueConsumer).toBe('function')
    expect(typeof mod.parseImageJob).toBe('function')
  })
})

describe('createImagePipeline (factory contract)', () => {
  it('exposes exactly the queue-era method set', () => {
    const { pipeline } = createTestPipeline()
    for (const name of [
      'submit',
      'enqueue',
      'retry',
      'generateImageFor',
      'enqueuePending',
      'sweep',
      'abandon',
    ]) {
      expect(typeof (pipeline as unknown as Record<string, unknown>)[name]).toBe('function')
    }
    // The pre-queue orchestration entry points MUST be gone: `drain` looped
    // `while (true)` over pending rows and generated them inline.
    const legacy = pipeline as unknown as Record<string, unknown>
    expect(legacy.drain).toBeUndefined()
    expect(legacy.drainOnePending).toBeUndefined()
    expect(legacy.run).toBeUndefined()
  })
})
