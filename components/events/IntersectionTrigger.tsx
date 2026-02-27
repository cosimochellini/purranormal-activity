import { useEffect, useRef } from 'react'
import { useInView } from 'react-intersection-observer'

interface IntersectionTriggerProps {
  onIntersect: () => void
  disabled?: boolean
  rootMargin?: string
  threshold?: number
}

export function IntersectionTrigger({
  onIntersect,
  disabled = false,
  rootMargin = '0px 0px 300px 0px',
  threshold = 0.1,
}: IntersectionTriggerProps) {
  const lastTriggerTime = useRef(0)
  const { ref, inView } = useInView({
    threshold,
    rootMargin,
    triggerOnce: false,
  })

  useEffect(() => {
    if (!inView || disabled) return

    const now = Date.now()
    // Prevent rapid successive calls (debounce for 500ms)
    if (now - lastTriggerTime.current < 500) return

    lastTriggerTime.current = now
    onIntersect()
  }, [inView, disabled, onIntersect])

  return (
    <div
      ref={ref}
      className="h-10 w-full flex items-center justify-center"
      data-testid="intersection-trigger"
    >
      {/* Visual indicator for debugging (can be removed in production) */}
      {process.env.NODE_ENV === 'development' && <div className="h-px bg-purple-500/20 w-full" />}
    </div>
  )
}
