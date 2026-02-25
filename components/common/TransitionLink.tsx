import { Link, type LinkComponentProps } from '@tanstack/react-router'
import type { ReactNode } from 'react'

interface TransitionLinkProps extends Omit<LinkComponentProps<'a'>, 'to' | 'preload' | 'children'> {
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
    <Link to={href} preload={prefetch ? 'intent' : false} viewTransition {...anchorProps}>
      {children}
    </Link>
  )
}
