import { useRouter } from '@tanstack/react-router'
import { useEffect } from 'react'
import { logger } from '../../utils/logger'

interface RefetchProps {
  interval: number
  shouldRefetch: boolean
}

export function Refetch({ interval, shouldRefetch }: RefetchProps) {
  const router = useRouter()

  useEffect(() => {
    if (!shouldRefetch) return

    // One-shot delayed refetch. Matches the previous self-limiting
    // window.location.reload() behavior — fire once after `interval` ms,
    // then stop. The parent must flip `shouldRefetch` back to true (e.g. by
    // remounting) if it wants another round.
    const timeoutId = setTimeout(() => {
      router.invalidate().catch((error) => {
        logger.error('Failed to invalidate router:', error)
      })
    }, interval)

    return () => clearTimeout(timeoutId)
  }, [interval, shouldRefetch, router])

  return null
}
