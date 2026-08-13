import { MAX_SEND_BATCH } from './config'
import type { ImageJob, QueuePort } from './ports'

/**
 * Queue write surface, as a factory over a queue accessor.
 *
 * Same shape as `services/imageStore/r2.ts`, for the same reason: the
 * accessor indirection keeps this module free of `cloudflare:workers`, so the
 * runtime binding is wired up once in `./adapters/queue.server.ts` and tests
 * pass a plain fake. `Queue<T>` is a global ambient type from
 * `worker-configuration.d.ts`, so no import is needed for it either.
 *
 * Errors are wrapped with a stable prefix and deliberately WITHOUT `{ cause }`
 * so `causeToErrorString` in the pipeline core surfaces this message rather
 * than digging into a provider-specific inner error.
 */
export const createQueueProducer = (getQueue: () => Queue<ImageJob>): QueuePort => ({
  async send(job) {
    try {
      await getQueue().send(job)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      throw new Error(`Queue send failed: ${message}`)
    }
  },

  async sendBatch(jobs) {
    if (jobs.length === 0) return
    try {
      // Queues caps a single `sendBatch` at 100 messages, so chunk rather than
      // letting a large sweep silently fail.
      for (let i = 0; i < jobs.length; i += MAX_SEND_BATCH) {
        const chunk = jobs.slice(i, i + MAX_SEND_BATCH)
        await getQueue().sendBatch(chunk.map((body) => ({ body })))
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      throw new Error(`Queue sendBatch failed: ${message}`)
    }
  },
})
