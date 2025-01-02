import cn from 'classnames'

export interface SpookyButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode
  variant?: 'primary' | 'secondary' | 'danger'
  isLoading?: boolean
  fullWidth?: boolean
}

const baseStyles = 'rounded-full px-8 py-4 text-lg font-medium relative group animate-fade-in-up transition-all duration-300'
const variantStyles = {
  primary: 'bg-magical-gradient hover:scale-105 hover:shadow-[0_0_20px_rgba(168,85,247,0.5)]',
  secondary: 'bg-gray-800 hover:bg-gray-700 hover:shadow-[0_0_20px_rgba(75,85,99,0.5)]',
  danger: 'bg-red-900/80 hover:bg-red-800 hover:scale-105 hover:shadow-[0_0_20px_rgba(220,38,38,0.5)]',
}

export function SpookyButton({
  children,
  variant = 'primary',
  isLoading = false,
  fullWidth = false,
  className,
  disabled,
  type = 'button',
  ...props
}: SpookyButtonProps) {
  return (
    <button
      disabled={isLoading || disabled}
      type={type}
      className={cn(
        baseStyles,
        variantStyles[variant],
        fullWidth && 'w-full',
        isLoading && 'cursor-wait opacity-80',
        disabled && 'cursor-not-allowed opacity-50',
        className,
      )}
      {...props}
    >
      <span className="relative z-10">
        {isLoading
          ? (
              <span className="inline-flex items-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Loading...
              </span>
            )
          : (
              children
            )}
      </span>
      <div
        className={cn(
          'absolute inset-0 rounded-full opacity-0 group-hover:opacity-100 blur-xl transition-opacity',
          variant === 'primary'
            ? 'bg-magical-gradient'
            : variant === 'danger' ? 'bg-red-800' : 'bg-gray-700',
        )}
      />
    </button>
  )
}
