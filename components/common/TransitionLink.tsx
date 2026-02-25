'use client'

import { Link, useRouter } from '@tanstack/react-router'
import type { AnchorHTMLAttributes, ReactNode } from 'react'

interface TransitionLinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  href: string
  children: ReactNode
  prefetch?: boolean
}

const isInternalHref = (href: string) =>
  href.startsWith('/') || href.startsWith('#') || href.startsWith('?')

export function TransitionLink({ children, href, prefetch, ...anchorProps }: TransitionLinkProps) {
  const router = useRouter({ warn: false }) as { navigate?: unknown } | undefined
  const useRouterLink = isInternalHref(href) && typeof router?.navigate === 'function'

  if (!useRouterLink) {
    return (
      <a href={href} {...anchorProps}>
        {children}
      </a>
    )
  }

  return (
    <Link
      to={href}
      preload={prefetch ? 'intent' : false}
      viewTransition
      {...(anchorProps as Omit<TransitionLinkProps, 'href' | 'prefetch'>)}
    >
      {children}
    </Link>
  )
}
