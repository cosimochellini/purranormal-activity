import { useEffect } from 'react'

interface RefetchProps {
  interval: number
  shouldRefetch: boolean
}

export function Refetch({ interval, shouldRefetch }: RefetchProps) {
  useEffect(() => {
    if (!shouldRefetch) return

    const intervalId = setInterval(() => {
      window.location.reload()
    }, interval)

    return () => clearInterval(intervalId)
  }, [interval, shouldRefetch])

  return null
}
