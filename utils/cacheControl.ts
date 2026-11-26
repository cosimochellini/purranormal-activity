import { CACHE_CONTROL } from '@/constants'

interface MatchLike {
  routeId: string
  loaderData?: unknown
}

/**
 * `Cache-Control` for an edge-cacheable page (see `services/edgeCache.server.ts`).
 * `cacheable` is the page's own verdict; on top of it, a page rendered while the
 * root loader's categories degraded to `[]` is never cached either.
 */
export const pageCacheControl = (cacheable: boolean, matches: readonly MatchLike[]) => {
  const categories = matches.find((m) => m.routeId === '__root__')?.loaderData
  const healthy = Array.isArray(categories) && categories.length > 0
  return { 'Cache-Control': cacheable && healthy ? CACHE_CONTROL.PAGE : CACHE_CONTROL.NO_STORE }
}
