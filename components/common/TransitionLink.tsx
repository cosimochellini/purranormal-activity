import { Link, type LinkComponentProps } from '@tanstack/react-router'
import type { ReactNode } from 'react'

interface TransitionLinkProps extends Omit<LinkComponentProps<'a'>, 'to' | 'preload' | 'children'> {
  href: string
  children: ReactNode
  prefetch?: boolean
}

const isInternalHref = (href: string) =>
  href.startsWith('/') || href.startsWith('#') || href.startsWith('?')

type LinkTo = LinkComponentProps<'a'>['to']

// TanStack Router types `Link.to` as the literal union of registered routes.
// TransitionLink is intentionally href-shaped (callers build paths with
// template strings like `/${id}`), so the cast goes through `unknown` to
// signal that the type narrowing is bypassed by design. Routing correctness
// is enforced by TanStack's runtime route resolution, not by this prop.
const asLinkTo = (href: string): LinkTo => href as unknown as LinkTo

export function TransitionLink({ children, href, prefetch, ...anchorProps }: TransitionLinkProps) {
  if (!isInternalHref(href)) {
    return (
      <a href={href} {...anchorProps}>
        {children}
      </a>
    )
  }

  return (
    <Link to={asLinkTo(href)} preload={prefetch ? 'intent' : false} viewTransition {...anchorProps}>
      {children}
    </Link>
  )
}
