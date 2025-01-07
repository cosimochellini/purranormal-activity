'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

interface RefetchProps {
  interval: number
  shouldRefetch: boolean
}

export function Refetch({ interval, shouldRefetch }: RefetchProps) {
  const router = useRouter()
  useEffect(() => {
    if (!shouldRefetch)
      return

    const intervalId = setInterval(router.refresh, interval)

    return () => clearInterval(intervalId)
  }, [interval, router, shouldRefetch])

  return null
}
