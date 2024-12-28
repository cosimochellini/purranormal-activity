import type { FC, ReactNode } from 'react'
import cn from 'classnames'
import Link from 'next/link'

interface SpookyLinkProps {
  href: string
  children: ReactNode
  className?: string
}

export const SpookyLink: FC<SpookyLinkProps> = ({ href, children, className }) => {
  return (
    <Link
      href={href}
      className={cn(
        'group relative transform transition-all duration-300',
        'hover:scale-110 hover:text-purple-300',
        className,
      )}
    >
      <span className="relative z-10">{children}</span>
      <div
        className={cn(
          'absolute -inset-1 blur-sm transition-opacity',
          'bg-purple-500/20 opacity-0 group-hover:opacity-100',
        )}
      />
    </Link>
  )
}
