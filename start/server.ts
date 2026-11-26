import { createStartHandler, defaultStreamHandler } from '@tanstack/react-start/server'
import { withEdgeCache } from '@/services/edgeCache.server'
import { createQueueConsumer, imagePipeline } from '@/services/imagePipeline'
import { logger } from '@/utils/logger'

/**
 * Worker entry. `wrangler.jsonc` points `main` here, and TanStack Start also
 * auto-discovers this path as the custom server entry.
 *
 * NOTE: deliberately NOT wrapped in `createServerEntry` from
 * `@tanstack/react-start/server-entry`. That helper returns `{ fetch }` and
 * nothing else, so `queue` and `scheduled` would be silently dropped from the
 * deployed worker — the queue would then retry every message twice and give
 * up, with no error anywhere. Keep this a plain object literal.
 *
 * Keep this file a wiring shim: it sits outside the vitest coverage include
 * list, so all the logic lives in `services/imagePipeline/` and
 * `services/edgeCache.server.ts`.
 */
const startFetch = createStartHandler(defaultStreamHandler)

const consume = createQueueConsumer({ pipeline: imagePipeline })

export default {
  // Miniflare honours `s-maxage` too: skip the edge cache in `vite dev`, or every
  // reload within 60s would serve stale SSR HTML.
  fetch: (request: Request, _env: unknown, ctx: ExecutionContext) =>
    import.meta.env.DEV
      ? startFetch(request)
      : withEdgeCache(request, ctx, () => startFetch(request)),
  // Return the promise rather than using `ctx.waitUntil`: the runtime keeps
  // the invocation alive for a returned promise, whereas `waitUntil` would let
  // the handler resolve before the ack/retry decisions were made.
  queue: (batch: MessageBatch<unknown>) => consume(batch),
  scheduled: async () => {
    try {
      await imagePipeline.sweep()
    } catch (error) {
      logger.error('scheduled: image sweep failed', { error })
    }
  },
}
