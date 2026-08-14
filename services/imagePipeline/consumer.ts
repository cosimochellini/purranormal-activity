import { logger as defaultLogger, type Logger } from '@/utils/logger'
import { QUEUE_NAMES, RETRY_DELAY_SECONDS } from './config'
import type { ImageJob, ImagePipeline } from './ports'

/**
 * Queue batch handler.
 *
 * Deliberately free of `cloudflare:workers`: `MessageBatch` and `Message` are
 * global ambient types from `worker-configuration.d.ts`, so this module runs
 * under Vitest against a hand-rolled fake batch. `start/server.ts` is only the
 * wiring shim.
 */
export interface QueueConsumerDeps {
  pipeline: Pick<ImagePipeline, 'generateImageFor' | 'abandon'>
  /** Overridable so tests do not depend on the production queue names. */
  queues?: { main: string; deadLetter: string }
  logger?: Logger
  retryDelaySeconds?: number
}

/**
 * Defensive body parse. A message we cannot read is acked, never retried:
 * redelivering junk just burns the budget and then the dead-letter queue.
 */
export const parseImageJob = (body: unknown): ImageJob | null => {
  if (!body || typeof body !== 'object') return null
  const record = body as Record<string, unknown>
  if (record.v !== 1) return null
  const { logId } = record
  if (typeof logId !== 'number' || !Number.isInteger(logId) || logId <= 0) return null
  const source = typeof record.source === 'string' ? record.source : 'script'
  return { v: 1, logId, source: source as ImageJob['source'] }
}

export const createQueueConsumer = (deps: QueueConsumerDeps) => {
  const log = deps.logger ?? defaultLogger
  const queues = deps.queues ?? QUEUE_NAMES
  const delaySeconds = deps.retryDelaySeconds ?? RETRY_DELAY_SECONDS

  return async (batch: MessageBatch<unknown>): Promise<void> => {
    const isDeadLetter = batch.queue === queues.deadLetter

    for (const message of batch.messages) {
      const job = parseImageJob(message.body)

      if (!job) {
        log.error('imageQueue: unparseable message body', {
          id: message.id,
          queue: batch.queue,
        })
        message.ack()
        continue
      }

      if (isDeadLetter) {
        log.error(`imageQueue: dead-lettered log ${job.logId}`, {
          attempts: message.attempts,
          source: job.source,
        })
        try {
          await deps.pipeline.abandon(job.logId, 'Image generation dead-lettered')
        } catch (error) {
          log.error('imageQueue: abandon threw in the dead-letter branch', {
            error,
            logId: job.logId,
          })
        }
        // Always ack: a dead-letter queue has no dead-letter queue of its own,
        // so a retry here either loops or is discarded. The cron sweeper is
        // the remaining net if `abandon` could not write.
        message.ack()
        continue
      }

      if (batch.queue !== queues.main) {
        // Neither the main queue nor the DLQ: a consumer was wired to a queue
        // this handler does not know about. Never generate on a guess.
        log.error('imageQueue: message from an unknown queue', {
          queue: batch.queue,
          logId: job.logId,
        })
        message.ack()
        continue
      }

      let report: Awaited<ReturnType<ImagePipeline['generateImageFor']>>
      try {
        report = await deps.pipeline.generateImageFor(job.logId, {
          deliveryAttempt: message.attempts,
        })
      } catch (error) {
        // `generateImageFor` is contractually non-throwing, so reaching here
        // means a failure it could not even record (typically the DB being
        // unreachable for both the claim and the error write). Retry rather
        // than ack: on the last allowed delivery this routes the message to
        // the dead-letter queue, whose branch forces the row out of `Created`.
        log.error(`imageQueue: generateImageFor threw for log ${job.logId}`, {
          error,
          attempts: message.attempts,
        })
        message.retry({ delaySeconds })
        continue
      }

      if (report.status === 'failed' && report.retryable) {
        message.retry({ delaySeconds })
        continue
      }

      // success | skipped | failed-and-terminal. Acking a terminal failure is
      // deliberate: the row is `Error` now, so a redelivery would only be
      // skipped as `not-pending` after paying for another DB round trip.
      message.ack()
    }
  }
}
