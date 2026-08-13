import { describe, expect, it, vi } from 'vitest'
import { LogStatus } from '@/data/enum/logStatus'
import { logger } from '@/utils/logger'
import { createTestPipeline } from '../../tests/fakes/imagePipeline'
import { createFakeBatch, createFakeMessage } from '../../tests/fakes/queue'
import { QUEUE_NAMES, RETRY_DELAY_SECONDS } from './config'
import { createQueueConsumer, parseImageJob } from './consumer'
import type { ImageJob, PipelineReport } from './ports'

const job = (logId = 7): ImageJob => ({ v: 1, logId, source: 'submit' })

const stubPipeline = (report: PipelineReport | (() => Promise<PipelineReport>)) => ({
  generateImageFor: vi.fn(async () => (typeof report === 'function' ? report() : report)),
  abandon: vi.fn(async (logId: number) => ({
    status: 'failed' as const,
    logId,
    retryable: false,
  })),
})

describe('parseImageJob', () => {
  it.each([
    ['null', null],
    ['a string', 'nope'],
    ['an empty object', {}],
    ['an unknown version', { v: 2, logId: 7 }],
    ['a non-numeric logId', { v: 1, logId: '7' }],
    ['a fractional logId', { v: 1, logId: 7.5 }],
    ['a non-positive logId', { v: 1, logId: 0 }],
  ])('rejects %s', (_label, body) => {
    expect(parseImageJob(body)).toBeNull()
  })

  it('accepts a well-formed job', () => {
    expect(parseImageJob({ v: 1, logId: 7, source: 'sweeper' })).toEqual({
      v: 1,
      logId: 7,
      source: 'sweeper',
    })
  })
})

describe('main queue branch', () => {
  it('acks a success', async () => {
    const pipeline = stubPipeline({ status: 'success', logId: 7 })
    const message = createFakeMessage(job())

    await createQueueConsumer({ pipeline })(createFakeBatch(QUEUE_NAMES.main, [message]))

    expect(message.acked).toBe(1)
    expect(message.retried).toHaveLength(0)
  })

  it.each(['not-found', 'not-pending'] as const)('acks a skip (%s)', async (reason) => {
    // `not-pending` is the ordinary duplicate case: retrying it would burn the
    // budget and then a dead-letter hop for nothing.
    const pipeline = stubPipeline({ status: 'skipped', logId: 7, reason })
    const message = createFakeMessage(job())

    await createQueueConsumer({ pipeline })(createFakeBatch(QUEUE_NAMES.main, [message]))

    expect(message.acked).toBe(1)
    expect(message.retried).toHaveLength(0)
  })

  it('retries a retryable failure with the configured delay', async () => {
    const pipeline = stubPipeline({ status: 'failed', logId: 7, retryable: true })
    const message = createFakeMessage(job())

    await createQueueConsumer({ pipeline })(createFakeBatch(QUEUE_NAMES.main, [message]))

    expect(message.retried).toEqual([{ delaySeconds: RETRY_DELAY_SECONDS }])
    expect(message.acked).toBe(0)
  })

  it('acks a terminal failure', async () => {
    const pipeline = stubPipeline({ status: 'failed', logId: 7, retryable: false })
    const message = createFakeMessage(job())

    await createQueueConsumer({ pipeline })(createFakeBatch(QUEUE_NAMES.main, [message]))

    expect(message.acked).toBe(1)
    expect(message.retried).toHaveLength(0)
  })

  it('passes the delivery counter through so the pipeline can decide finality', async () => {
    const pipeline = stubPipeline({ status: 'success', logId: 7 })
    const message = createFakeMessage(job(), { attempts: 2 })

    await createQueueConsumer({ pipeline })(createFakeBatch(QUEUE_NAMES.main, [message]))

    expect(pipeline.generateImageFor).toHaveBeenCalledWith(7, { deliveryAttempt: 2 })
  })

  it('acks an unparseable body without calling the pipeline', async () => {
    const pipeline = stubPipeline({ status: 'success', logId: 7 })
    const message = createFakeMessage({ garbage: true })
    vi.mocked(logger.error).mockClear()

    await createQueueConsumer({ pipeline })(createFakeBatch(QUEUE_NAMES.main, [message]))

    expect(pipeline.generateImageFor).not.toHaveBeenCalled()
    expect(message.acked).toBe(1)
    expect(vi.mocked(logger.error)).toHaveBeenCalled()
  })

  it('retries when generateImageFor throws, even on the last delivery', async () => {
    // `generateImageFor` is contractually non-throwing, so this means a failure
    // it could not record. Retrying routes the message to the dead-letter queue
    // on the final delivery, and that branch forces the row out of `Created`.
    const pipeline = stubPipeline(async () => {
      throw new Error('turso unreachable')
    })
    const message = createFakeMessage(job(), { attempts: 2 })
    vi.mocked(logger.error).mockClear()

    await createQueueConsumer({ pipeline })(createFakeBatch(QUEUE_NAMES.main, [message]))

    expect(message.retried).toEqual([{ delaySeconds: RETRY_DELAY_SECONDS }])
    expect(message.acked).toBe(0)
    expect(vi.mocked(logger.error)).toHaveBeenCalled()
  })

  it('isolates one throwing message from its batch siblings', async () => {
    const pipeline = {
      generateImageFor: vi.fn(async (logId: number) => {
        if (logId === 1) throw new Error('boom')
        return { status: 'success' as const, logId }
      }),
      abandon: vi.fn(async (logId: number) => ({
        status: 'failed' as const,
        logId,
        retryable: false,
      })),
    }
    const first = createFakeMessage(job(1))
    const second = createFakeMessage(job(2))

    await createQueueConsumer({ pipeline })(createFakeBatch(QUEUE_NAMES.main, [first, second]))

    expect(first.retried).toHaveLength(1)
    expect(second.acked).toBe(1)
    expect(pipeline.generateImageFor).toHaveBeenCalledTimes(2)
  })

  it('never reaches for the batch-level ack/retry helpers', async () => {
    // `retryAll` would punish siblings for one message's failure.
    const pipeline = stubPipeline({ status: 'failed', logId: 7, retryable: true })
    const batch = createFakeBatch(QUEUE_NAMES.main, [createFakeMessage(job())])

    await createQueueConsumer({ pipeline })(batch)

    expect(batch.ackedAll).toBe(0)
    expect(batch.retriedAll).toBe(0)
  })

  it('acks without generating for a queue it does not recognise', async () => {
    const pipeline = stubPipeline({ status: 'success', logId: 7 })
    const message = createFakeMessage(job())

    await createQueueConsumer({ pipeline })(createFakeBatch('some-other-queue', [message]))

    expect(pipeline.generateImageFor).not.toHaveBeenCalled()
    expect(pipeline.abandon).not.toHaveBeenCalled()
    expect(message.acked).toBe(1)
  })
})

describe('dead-letter branch', () => {
  it('abandons the row and acks, without generating', async () => {
    const pipeline = stubPipeline({ status: 'success', logId: 7 })
    const message = createFakeMessage(job())

    await createQueueConsumer({ pipeline })(createFakeBatch(QUEUE_NAMES.deadLetter, [message]))

    expect(pipeline.generateImageFor).not.toHaveBeenCalled()
    expect(pipeline.abandon).toHaveBeenCalledWith(7, 'Image generation dead-lettered')
    expect(message.acked).toBe(1)
    expect(message.retried).toHaveLength(0)
  })

  it('still acks when abandon throws', async () => {
    // A dead-letter queue has no dead-letter queue of its own, so a retry here
    // either loops or is silently discarded.
    const pipeline = {
      generateImageFor: vi.fn(),
      abandon: vi.fn(async () => {
        throw new Error('db down')
      }),
    }
    const message = createFakeMessage(job())

    await createQueueConsumer({ pipeline })(createFakeBatch(QUEUE_NAMES.deadLetter, [message]))

    expect(message.acked).toBe(1)
    expect(message.retried).toHaveLength(0)
  })
})

describe('end-to-end two-attempt retry (real pipeline, fake queue)', () => {
  it('re-runs generation on the redelivery and only then marks the row Error', async () => {
    // The single most important test in the change: if the first failure wrote
    // `Error`, the redelivery would be skipped as `not-pending` and the retry
    // would be a silent no-op.
    const { pipeline, repo, store, aiImage } = createTestPipeline()
    repo.preload([{ id: 7, imageDescription: 'p', status: LogStatus.Created }])
    store.setPutThrow(new Error('R2 upload failed: internal error'))

    const consume = createQueueConsumer({ pipeline })

    const first = createFakeMessage(job(), { attempts: 1 })
    await consume(createFakeBatch(QUEUE_NAMES.main, [first]))

    expect(first.retried).toEqual([{ delaySeconds: RETRY_DELAY_SECONDS }])
    expect(repo.findRow(7)?.status).toBe(LogStatus.Created)
    expect(repo.findRow(7)?.attempts).toBe(1)
    expect(aiImage.calls).toHaveLength(1)

    const second = createFakeMessage(job(), { attempts: 2 })
    await consume(createFakeBatch(QUEUE_NAMES.main, [second]))

    expect(second.acked).toBe(1)
    expect(second.retried).toHaveLength(0)
    // Generation actually ran a second time.
    expect(aiImage.calls).toHaveLength(2)
    const row = repo.findRow(7)
    expect(row?.status).toBe(LogStatus.Error)
    expect(row?.attempts).toBe(2)
    expect(row?.error).toBe('R2 upload failed: internal error')
  })

  it('bounds total generations per row even when duplicate messages arrive', async () => {
    // Three messages for one log (submit + operator + sweeper). The atomic
    // claim is what keeps the OpenAI bill at MAX_ATTEMPTS rather than three.
    const { pipeline, repo, store, aiImage } = createTestPipeline()
    repo.preload([{ id: 7, imageDescription: 'p', status: LogStatus.Created }])
    store.setPutThrow(new Error('R2 upload failed: internal error'))

    const consume = createQueueConsumer({ pipeline })
    for (const attempts of [1, 1, 1]) {
      await consume(createFakeBatch(QUEUE_NAMES.main, [createFakeMessage(job(), { attempts })]))
    }

    expect(aiImage.calls).toHaveLength(2)
    expect(repo.findRow(7)?.status).toBe(LogStatus.Error)
  })

  it('acks a dead-lettered row and leaves it terminal (real pipeline)', async () => {
    const { pipeline, repo } = createTestPipeline()
    repo.preload([{ id: 7, status: LogStatus.Created, attempts: 2 }])

    const message = createFakeMessage(job())
    await createQueueConsumer({ pipeline })(createFakeBatch(QUEUE_NAMES.deadLetter, [message]))

    expect(message.acked).toBe(1)
    const row = repo.findRow(7)
    expect(row?.status).toBe(LogStatus.Error)
    expect(row?.error).toBe('Image generation dead-lettered')
  })

  it('does not touch a dead-lettered row that succeeded in the meantime', async () => {
    const { pipeline, repo } = createTestPipeline()
    repo.preload([{ id: 7, status: LogStatus.ImageGenerated }])

    await createQueueConsumer({ pipeline })(
      createFakeBatch(QUEUE_NAMES.deadLetter, [createFakeMessage(job())]),
    )

    const row = repo.findRow(7)
    expect(row?.status).toBe(LogStatus.ImageGenerated)
    expect(row?.error).toBeNull()
  })
})
