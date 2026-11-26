import { createRouter } from '@tanstack/react-router'
import { Loading } from '@/components/common/Loading'
import { NotFoundPage } from '@/components/common/NotFoundPage'
import { RouteError } from '@/components/common/RouteError'
import { routeTree } from './routeTree.gen'

export function getRouter() {
  return createRouter({
    routeTree,
    defaultPreload: 'intent',
    // Hover/touch preloads stay fresh for 30s, so the click that follows renders
    // from cache. Mutations invalidate the routes they touch explicitly.
    defaultPreloadStaleTime: 30_000,
    defaultPendingComponent: Loading,
    defaultErrorComponent: RouteError,
    defaultNotFoundComponent: NotFoundPage,
    scrollRestoration: true,
  })
}
