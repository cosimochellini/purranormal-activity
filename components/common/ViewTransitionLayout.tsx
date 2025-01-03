'use client'

import { usePathname } from 'next/navigation'
import { useEffect, useRef } from 'react'
import { startViewTransition } from '../../utils/viewTransition'

export function ViewTransitionLayout() {
  const pathname = usePathname()
  const previousPathRef = useRef(pathname)

  useEffect(() => {
    // If the pathname changed, we can trigger a view transition
    if (pathname !== previousPathRef.current) {
      startViewTransition(() => {
        // If you have code that needs to run just before or after
        // the transition completes, put it here. For a typical
        // route transition, you may not need to do anything inside.
      })
      previousPathRef.current = pathname
    }
  }, [pathname])

  return null
}
