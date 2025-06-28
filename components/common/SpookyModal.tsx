import { IconX } from '@tabler/icons-react'
import cn from 'classnames'
import type { ComponentPropsWithoutRef } from 'react'
import { useEffect } from 'react'

interface SpookyModalProps extends ComponentPropsWithoutRef<'div'> {
  title: string
  open: boolean
  onClose: () => void
}

export function SpookyModal({
  children,
  title,
  open,
  onClose,
  className,
  ...props
}: SpookyModalProps) {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [onClose])

  if (!open) return null

  const handleBackdropClick = () => onClose()
  const handleBackdropKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onClose()
    }
  }

  return (
    <div
      className="relative z-50"
      role="dialog"
      aria-modal="true"
      {...props}
      onClick={handleBackdropClick}
      onKeyDown={handleBackdropKeyDown}
      tabIndex={-1}
    >
      {/* Backdrop */}
      <div className="fixed inset-0 bg-purple-950/60 backdrop-blur-xl" />

      {/* Modal Container */}
      <div className="fixed inset-0 z-50 w-screen overflow-y-auto">
        <div className="flex min-h-full items-center justify-center p-4 text-center sm:p-0">
          {/* Modal Panel */}
          <div
            className={cn(
              'relative w-full max-w-md transform overflow-hidden rounded-2xl',
              'border border-purple-400/20 bg-purple-900/80 p-6',
              'text-left shadow-[0_0_30px_rgba(168,85,247,0.15)]',
              'transition-all duration-300 ease-out',
              'sm:my-8',
              className,
            )}
            role="document"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            <header className="mb-6 flex items-center justify-between">
              <h2 className="text-2xl">{title}</h2>
              <button
                type="button"
                onClick={onClose}
                className="rounded-full p-2 text-purple-300/70 hover:bg-purple-800/30 hover:text-white transition-colors duration-200"
                aria-label="Close modal"
              >
                <IconX className="h-6 w-6" />
              </button>
            </header>

            <div className="relative">{children}</div>

            {/* Decorative sparkles */}
            <div className="absolute -top-4 left-1/4 h-2 w-2 animate-sparkle rounded-full bg-purple-300/80 blur-[1px]" />
            <div className="absolute -bottom-2 right-1/3 h-2 w-2 animate-sparkle delay-300 rounded-full bg-purple-300/80 blur-[1px]" />
          </div>
        </div>
      </div>
    </div>
  )
}
