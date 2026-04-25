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

    const intervalId = setInterval(() => {
      router.invalidate().catch((error) => {
        logger.error('Failed to invalidate router:', error)
      })
    }, interval)

    return () => clearInterval(intervalId)
  }, [interval, shouldRefetch, router])

  return null
}
