import { env } from 'cloudflare:workers'
import { createR2ImageStore } from './r2'

/**
 * The only module in the repo that touches the R2 runtime binding.
 *
 * The `.server.ts` suffix is load-bearing: it matches TanStack Start's default
 * client-side import-protection file rule (`**\/*.server.*`), so in the client
 * environment this module's body is replaced with a mock before Rollup ever
 * resolves `cloudflare:workers`. That matters because
 * `start/routeTree.gen.ts` statically imports every API route, and route
 * *handler bodies* are stripped from the client bundle while top-level imports
 * are not. See the `importProtection.include` note in `vite.config.mts` — the
 * rule only applies to files the gate covers.
 *
 * The binding is read per call (never at module scope): on Workers, module
 * evaluation predates the per-request env, same reasoning as the lazy getters
 * in `env/server.ts`.
 */
export const imageStore = createR2ImageStore(() => env.IMAGES)
