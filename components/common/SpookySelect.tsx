import type { ComponentPropsWithoutRef } from 'react'
import cn from 'classnames'

interface Option<T extends string> {
  value: T
  label: string
}

type SelectProps<T extends string> = ComponentPropsWithoutRef<'select'> & {
  label?: string
  error?: string
  options: Option<T>[]
}

const baseClasses = [
  'w-full rounded-md border transition-colors duration-200',
  'border-purple-700/30 bg-purple-900/30',
  'px-4 py-2 text-white',
  'focus:border-magical-accent focus:outline-none focus:ring-2 focus:ring-magical-accent/20',
  'appearance-none cursor-pointer',
]

export function SpookySelect<T extends string>({
  label,
  error,
  options,
  className,
  id,
  ...props
}: SelectProps<T>) {
  return (
    <div className="space-y-2">
      {label && (
        <label htmlFor={id} className="block text-sm font-medium text-purple-200">
          {label}
        </label>
      )}
      <div className="relative">
        <select
          id={id}
          className={cn(
            ...baseClasses,
            error && 'border-red-500/50 focus:border-red-500 focus:ring-red-500/20',
            className,
          )}
          {...props}
        >
          {options.map(option => (
            <option
              key={option.value}
              value={option.value}
              className="bg-purple-900"
            >
              {option.label}
            </option>
          ))}
        </select>

        {/* Custom dropdown arrow */}
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4">
          <div className="h-4 w-4 border-r-2 border-b-2 border-purple-300/50 transform rotate-45 translate-y-[-2px]" />
        </div>

        {/* Sparkle effects */}
        <div className="absolute -top-2 right-1/4 h-1 w-1 animate-sparkle rounded-full bg-purple-300/80 blur-[1px]" />
        <div className="absolute -bottom-1 left-1/3 h-1 w-1 animate-sparkle delay-300 rounded-full bg-purple-300/80 blur-[1px]" />
      </div>
      {error && (
        <p className="text-sm text-red-400">{error}</p>
      )}
    </div>
  )
}
