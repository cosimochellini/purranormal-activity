import type { AnchorHTMLAttributes, ReactNode } from 'react'

interface TransitionLinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  href: string
  children: ReactNode
  prefetch?: boolean
}

export function TransitionLink({ children, prefetch: _prefetch, ...props }: TransitionLinkProps) {
  return <a {...props}>{children}</a>
}
