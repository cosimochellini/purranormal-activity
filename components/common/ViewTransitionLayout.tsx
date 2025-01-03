'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { startViewTransition } from '../../utils/viewTransition'

export function ViewTransitionLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()

  const handleClick = (e: MouseEvent) => {
    const link = (e.target as HTMLElement).closest('a')
    if (!link)
      return

    if (
      link.href
      && link.href.startsWith(window.location.origin)
      && !e.ctrlKey
      && !e.metaKey
      && !e.altKey
      && !e.shiftKey
    ) {
      e.preventDefault()
      startViewTransition(() => router.push(link.href))
    }
  }

  // Add event listener for link clicks
  useEffect(() => {
    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [])

  return children
}
