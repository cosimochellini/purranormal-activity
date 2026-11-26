import { logger } from '@/utils/logger'

/**
 * SSR edge cache on the Workers Cache API.
 *
 * Worker responses are never cached by the CDN on their own, so this caches
 * page HTML explicitly. A page opts in through its route `headers()` by sending
 * `CACHE_CONTROL.PAGE`; everything else (server functions, `/api/*`, non-GET,
 * non-200, pages without `s-maxage`, any URL with a query string) passes
 * straight through. Query strings are excluded so a purge of `/<path>` always
 * drops the only cached copy of that page.
 *
 * `caches.default` is a silent no-op on `*.workers.dev` hosts: this layer only
 * does anything once the worker is served from a custom domain.
 *
 * Purges are per data centre (`cache.delete` is colo-local); other colos expire
 * by TTL, which is why the TTL is short.
 */

const SHARED_MAX_AGE = /\bs-maxage=\d+/

interface WaitUntil {
  waitUntil(promise: Promise<unknown>): void
}

const pageCache = (): Cache | undefined =>
  (globalThis.caches as (CacheStorage & { default?: Cache }) | undefined)?.default

const isPageRequest = (request: Request) => {
  if (request.method !== 'GET' || request.headers.has('x-tsr-serverFn')) return false
  const { pathname, search } = new URL(request.url)
  return !search && !pathname.startsWith('/api/') && !pathname.startsWith('/_serverFn')
}

/**
 * The build id is part of the key: cached HTML references hashed assets, and a
 * page cached before a deploy must not outlive the assets it points at.
 */
const cacheKey = (url: string) => {
  const key = new URL(url)
  key.searchParams.set('__build', __BUILD_ID__)
  return new Request(key.toString())
}

export const withEdgeCache = async (
  request: Request,
  ctx: WaitUntil,
  render: () => Promise<Response> | Response,
): Promise<Response> => {
  const cache = pageCache()
  if (!cache || !isPageRequest(request)) return render()

  const key = cacheKey(request.url)
  try {
    const hit = await cache.match(key)
    if (hit) return hit
  } catch (error) {
    logger.warn('edge cache: match failed', error)
  }

  const response = await render()
  if (response.status === 200 && SHARED_MAX_AGE.test(response.headers.get('Cache-Control') ?? '')) {
    ctx.waitUntil(
      cache
        .put(key, response.clone())
        .catch((error) => logger.warn('edge cache: put failed', error)),
    )
  }
  return response
}

/** Drops cached pages for `paths` on `origin`. Never throws: a stale page is not worth a failed write. */
export const purgePages = async (origin: string, paths: readonly string[]) => {
  const cache = pageCache()
  if (!cache) return
  await Promise.all(
    paths.map((path) =>
      cache
        .delete(cacheKey(new URL(path, origin).toString()))
        .catch((error) => logger.warn(`edge cache: purge of ${path} failed`, error)),
    ),
  )
}
