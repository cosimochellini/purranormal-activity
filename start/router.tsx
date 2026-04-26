import { type AnyRouter, createRouter } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'

let activeRouter: AnyRouter | undefined

export function getActiveRouter(): AnyRouter | undefined {
  return activeRouter
}

export function getRouter() {
  const router = createRouter({
    routeTree,
    defaultPreload: 'intent',
    scrollRestoration: true,
  })

  if (typeof window !== 'undefined') {
    activeRouter = router
  }

  return router
}
