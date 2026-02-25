'use client'

import { Link } from '@tanstack/react-router'
import type { AnchorHTMLAttributes, ReactNode } from 'react'

interface TransitionLinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  href: string
  children: ReactNode
  prefetch?: boolean
}

const isInternalHref = (href: string) =>
  href.startsWith('/') || href.startsWith('#') || href.startsWith('?')

export function TransitionLink({ children, href, prefetch, ...anchorProps }: TransitionLinkProps) {
  if (!isInternalHref(href)) {
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
