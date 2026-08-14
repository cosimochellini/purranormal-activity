import { describe, expect, it, vi } from 'vitest'
import { MAX_SEND_BATCH } from './config'
import type { ImageJob } from './ports'
import { createQueueProducer } from './queue'

const job = (logId: number): ImageJob => ({ v: 1, logId, source: 'script' })

const fakeQueue = () => {
  const sent: unknown[] = []
  const batches: unknown[][] = []
  return {
    queue: {
      send: vi.fn(async (message: unknown) => {
        sent.push(message)
      }),
      sendBatch: vi.fn(async (messages: Iterable<{ body: unknown }>) => {
        batches.push([...messages])
      }),
    } as unknown as Queue<ImageJob>,
    sent,
    batches,
  }
}

describe('createQueueProducer', () => {
  it('forwards the job body to the binding', async () => {
    const { queue, sent } = fakeQueue()

    await createQueueProducer(() => queue).send(job(7))

    expect(sent).toEqual([{ v: 1, logId: 7, source: 'script' }])
  })

  it('reads the binding per call, not once at factory time', async () => {
    // Mirrors the r2.server rationale: on Workers, module evaluation predates
    // the per-request env, so an accessor captured eagerly would be stale.
    const { queue } = fakeQueue()
    const getQueue = vi.fn(() => queue)
    const producer = createQueueProducer(getQueue)

    expect(getQueue).not.toHaveBeenCalled()
    await producer.send(job(1))
    await producer.send(job(2))
    expect(getQueue).toHaveBeenCalledTimes(2)
  })

  it('wraps a send failure with a stable prefix', async () => {
    const producer = createQueueProducer(
      () =>
        ({
          send: async () => {
            throw new Error('too many requests')
          },
        }) as unknown as Queue<ImageJob>,
    )

    await expect(producer.send(job(7))).rejects.toThrow('Queue send failed: too many requests')
  })

  it('does not touch the binding for an empty batch', async () => {
    const getQueue = vi.fn(() => fakeQueue().queue)

    await createQueueProducer(getQueue).sendBatch([])

    expect(getQueue).not.toHaveBeenCalled()
  })

  it('maps each job into the MessageSendRequest shape', async () => {
    const { queue, batches } = fakeQueue()

    await createQueueProducer(() => queue).sendBatch([job(1), job(2)])

    expect(batches).toEqual([[{ body: job(1) }, { body: job(2) }]])
  })

  it('chunks a batch larger than the 100-message platform cap', async () => {
    const { queue, batches } = fakeQueue()
    const jobs = Array.from({ length: MAX_SEND_BATCH + 50 }, (_, i) => job(i + 1))

    await createQueueProducer(() => queue).sendBatch(jobs)

    expect(batches).toHaveLength(2)
    expect(batches[0]).toHaveLength(MAX_SEND_BATCH)
    expect(batches[1]).toHaveLength(50)
  })

  it('wraps a sendBatch failure with a stable prefix', async () => {
    const producer = createQueueProducer(
      () =>
        ({
          sendBatch: async () => {
            throw new Error('storage limit exceeded')
          },
        }) as unknown as Queue<ImageJob>,
    )

    await expect(producer.sendBatch([job(7)])).rejects.toThrow(
      'Queue sendBatch failed: storage limit exceeded',
    )
  })
})
