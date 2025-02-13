import type { ComponentPropsWithoutRef } from 'react'

import cn from 'classnames'

const baseClasses = [
  'w-full rounded-md border transition-colors duration-200',
  'border-purple-700/30 bg-purple-900/30',
  'px-4 py-2 text-white placeholder-purple-300/50',
  'focus:border-magical-accent focus:outline-none focus:ring-2 focus:ring-magical-accent/20',
]

type InputProps = ComponentPropsWithoutRef<'input'> & {
  label?: string
  error?: string
}

export function SpookyInput({
  label,
  error,
  className,
  id,
  ...props
}: InputProps) {
  return (
    <div className="space-y-2">
      {label && (
        <label htmlFor={id} className="block text-sm font-medium text-purple-200">
          {label}
        </label>
      )}
      <input
        id={id}
        className={cn(
          ...baseClasses,
          error && 'border-red-500/50 focus:border-red-500 focus:ring-red-500/20',
          className,
        )}
        {...props}
      />
      {error && (
        <p className="text-sm text-red-400">{error}</p>
      )}
    </div>
  )
}
