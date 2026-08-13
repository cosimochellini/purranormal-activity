import { env } from 'cloudflare:workers'
import { createQueueProducer } from '../queue'

/**
 * The only module in the repo that touches the image-jobs queue binding.
 *
 * The `.server.ts` suffix is load-bearing, exactly as documented in
 * `services/imageStore/r2.server.ts`: it matches TanStack Start's default
 * client-side import-protection file rule (`**\/*.server.*`), so in the client
 * environment this module's body is replaced with a mock before Rollup ever
 * resolves `cloudflare:workers`. `start/routeTree.gen.ts` statically imports
 * every API route, and top-level imports are not stripped from the client
 * bundle even though handler bodies are.
 *
 * The binding is read per call (never at module scope): on Workers, module
 * evaluation predates the per-request env.
 */
export const imageQueue = createQueueProducer(() => env.IMAGE_QUEUE)
