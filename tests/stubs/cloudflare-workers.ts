/**
 * Resolution-only stand-in for the `cloudflare:workers` builtin, wired up via
 * `resolve.alias` in `vitest.config.ts`.
 *
 * Vitest deliberately loads neither `cloudflare()` nor `tanstackStart()` (they
 * boot a Wrangler runtime that breaks the worker pool), so import protection is
 * absent and `services/imageStore/r2.server.ts` is loaded for real — e.g.
 * `services/imagePipeline/index.test.ts` imports `@/services/imagePipeline`
 * without mocking it, which reaches the R2 module transitively. Without this
 * alias that import fails to resolve.
 *
 * R2 behaviour itself is covered by calling `createR2ImageStore(() =>
 * fakeBucket)` from `services/imageStore/r2.ts` directly. The one test that
 * does touch this object is `services/imageStore/r2.server.test.ts`, which
 * assigns `env.IMAGES` to assert the binding is actually wired up.
 */
export const env = {} as Cloudflare.Env
