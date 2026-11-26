import { createLink, type LinkComponent } from '@tanstack/react-router'
import cn from 'classnames'
import type { ComponentProps } from 'react'

function SpookyAnchor({ className, children, ...props }: ComponentProps<'a'>) {
  return (
    <a
      {...props}
      className={cn(
        'group relative transform transition-all duration-300',
        'hover:scale-110 hover:text-purple-300',
        className,
      )}
    >
      <span className="relative z-10">{children}</span>
      <div
        className={cn(
          'absolute -inset-1 blur-xs transition-opacity',
          'bg-purple-500/20 opacity-0 group-hover:opacity-100',
        )}
      />
    </a>
  )
}

const SpookyRouterLink = createLink(SpookyAnchor)

export const SpookyLink: LinkComponent<typeof SpookyAnchor> = (props) => (
  <SpookyRouterLink viewTransition {...props} />
)
