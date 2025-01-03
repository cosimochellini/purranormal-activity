import type { ComponentProps } from 'react'
import { Link } from 'next-view-transitions'

interface TransitionLinkProps extends ComponentProps<typeof Link> {
  children: React.ReactNode
}

export function TransitionLink({ children, ...props }: TransitionLinkProps) {
  return (
    <Link {...props}>
      {children}
    </Link>
  )
}
