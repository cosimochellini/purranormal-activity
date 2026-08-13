import type { ImageJob, QueuePort } from '@/services/imagePipeline/ports'

// In-memory `QueuePort` plus hand-rolled `Message` / `MessageBatch` doubles.
// `MessageBatch` and `Message` are ambient Workers globals (declared in
// `worker-configuration.d.ts`), so the consumer can be unit-tested without a
// workerd runtime — the vitest config deliberately loads neither the
// cloudflare nor the tanstackStart vite plugin.

export interface InMemoryQueue extends QueuePort {
  /** Every job handed to `send` or `sendBatch`, flattened, in order. */
  sent: ImageJob[]
  /** One entry per `sendBatch` call, so chunking is observable. */
  batches: ImageJob[][]
  setSendThrow(err: unknown): void
  setSendBatchThrow(err: unknown): void
}

export const createInMemoryQueue = (): InMemoryQueue => {
  const sent: ImageJob[] = []
  const batches: ImageJob[][] = []
  let sendThrow: unknown
  let sendShouldThrow = false
  let sendBatchThrow: unknown
  let sendBatchShouldThrow = false

  return {
    sent,
    batches,
    async send(job) {
      if (sendShouldThrow) throw sendThrow
      sent.push(job)
    },
    async sendBatch(jobs) {
      if (sendBatchShouldThrow) throw sendBatchThrow
      const chunk = [...jobs]
      batches.push(chunk)
      sent.push(...chunk)
    },
    setSendThrow(err) {
      sendThrow = err
      sendShouldThrow = true
    },
    setSendBatchThrow(err) {
      sendBatchThrow = err
      sendBatchShouldThrow = true
    },
  }
}

export interface FakeMessage<T> extends Message<T> {
  acked: number
  retried: QueueRetryOptions[]
}

/**
 * `attempts` defaults to 1 because Cloudflare's counter is 1-based on the
 * first delivery — pass 2 to simulate the redelivery after a `retry()`.
 */
export const createFakeMessage = <T>(
  body: T,
  opts: { id?: string; attempts?: number } = {},
): FakeMessage<T> => {
  const message = {
    id: opts.id ?? 'msg-1',
    timestamp: new Date(0),
    body,
    attempts: opts.attempts ?? 1,
    acked: 0,
    retried: [] as QueueRetryOptions[],
    ack() {
      message.acked++
    },
    retry(options?: QueueRetryOptions) {
      message.retried.push(options ?? {})
    },
  }
  return message as FakeMessage<T>
}

export interface FakeBatch<T> extends MessageBatch<T> {
  messages: FakeMessage<T>[]
  ackedAll: number
  retriedAll: number
}

export const createFakeBatch = <T>(queue: string, messages: FakeMessage<T>[]): FakeBatch<T> => {
  const batch = {
    queue,
    messages,
    metadata: { metrics: { backlogCount: 0, backlogBytes: 0 } },
    ackedAll: 0,
    retriedAll: 0,
    ackAll() {
      batch.ackedAll++
    },
    retryAll() {
      batch.retriedAll++
    },
  }
  return batch as unknown as FakeBatch<T>
}
