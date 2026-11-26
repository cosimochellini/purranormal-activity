import { createRouter } from '@tanstack/react-router'
import { Loading } from '@/components/common/Loading'
import { NotFoundPage } from '@/components/common/NotFoundPage'
import { RouteError } from '@/components/common/RouteError'
import { routeTree } from './routeTree.gen'

export function getRouter() {
  return createRouter({
    routeTree,
    // Hover/touch preloads (fresh for the default 30s) make the click that
    // follows render from cache. Mutations invalidate what they touch.
    defaultPreload: 'intent',
    defaultPendingComponent: Loading,
    defaultErrorComponent: RouteError,
    defaultNotFoundComponent: NotFoundPage,
    scrollRestoration: true,
  })
}
