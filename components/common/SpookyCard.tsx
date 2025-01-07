import type { ComponentPropsWithoutRef } from 'react'
import cn from 'classnames'

interface SpookyCardProps extends ComponentPropsWithoutRef<'div'> {
  variant?: 'default' | 'hover'
}

export function SpookyCard({ className, variant = 'default', children, ...props }: SpookyCardProps) {
  return (
    <div
      className={cn(
        'relative space-y-8 rounded-2xl',
        'border border-purple-700/30 bg-purple-900/30',
        'p-6 backdrop-blur-sm',
        variant === 'hover' && 'transition-colors duration-300 hover:bg-purple-800/30',
        className,
      )}
      {...props}
    >
      {children}
      {/* Sparkle effects */}
      <div className="absolute -top-4 left-1/4 h-2 w-2 animate-sparkle rounded-full bg-purple-300/80 blur-[1px]" />
      <div className="absolute -bottom-2 right-1/3 h-2 w-2 animate-sparkle delay-300 rounded-full bg-purple-300/80 blur-[1px]" />
    </div>
  )
}
