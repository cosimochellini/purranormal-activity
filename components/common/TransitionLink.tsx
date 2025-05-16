import { Link } from 'next-view-transitions'
import type { ComponentProps } from 'react'

interface TransitionLinkProps extends ComponentProps<typeof Link> {
  children: React.ReactNode
}

export function TransitionLink({ children, ...props }: TransitionLinkProps) {
  return <Link {...props}>{children}</Link>
}
