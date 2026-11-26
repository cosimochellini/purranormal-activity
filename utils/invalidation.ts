import type { AnyRouteMatch, AnyRouter } from '@tanstack/react-router'

export type InvalidationTag = 'logs' | `log:${number}`

const LIST_ROUTE_IDS: ReadonlySet<string> = new Set(['/', '/explore'])
const DETAIL_ROUTE_IDS: ReadonlySet<string> = new Set(['/$id/', '/$id/edit'])

const LOG_TAG_PREFIX = 'log:'

interface MatchableRoute {
  routeId: string
  params?: Record<string, string | undefined>
}

export function matchesTags(
  match: MatchableRoute | AnyRouteMatch,
  tags: readonly InvalidationTag[],
): boolean {
  if (tags.length === 0) return false

  const m = match as MatchableRoute
  const params = m.params as Record<string, string | undefined> | undefined

  for (const tag of tags) {
    if (tag === 'logs') {
      if (LIST_ROUTE_IDS.has(m.routeId)) return true
      continue
    }

    if (typeof tag === 'string' && tag.startsWith(LOG_TAG_PREFIX)) {
      const id = tag.slice(LOG_TAG_PREFIX.length)
      if (id.length > 0 && DETAIL_ROUTE_IDS.has(m.routeId) && params?.id === id) {
        return true
      }
    }
  }

  return false
}

/**
 * Re-run the loaders of the routes a write made stale. Called by the UI after a
 * successful server-function mutation.
 */
export function invalidateTags(
  router: Pick<AnyRouter, 'invalidate'>,
  tags: readonly InvalidationTag[],
): Promise<void> {
  return router.invalidate({ filter: (match) => matchesTags(match, tags) })
}
