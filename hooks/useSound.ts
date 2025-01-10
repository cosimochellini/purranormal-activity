import { useEffect, useRef } from 'react'
import { logger } from '../utils/logger'

interface UseSoundOptions {
  volume?: number
  loop?: boolean
  autoplay?: boolean
}

export function useSound(soundPath: string, options: UseSoundOptions = {}) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const optionsRef = useRef(options)

  useEffect(() => {
    // Create audio element only on client side
    if (typeof window !== 'undefined') {
      audioRef.current = new Audio(soundPath)
      audioRef.current.volume = optionsRef.current.volume ?? 1
      audioRef.current.loop = optionsRef.current.loop ?? false

      if (optionsRef.current.autoplay)
        audioRef.current.play()
    }

    // Cleanup
    return () => {
      if (!audioRef.current)
        return

      audioRef.current.pause()
      audioRef.current = null
    }
  }, [soundPath])

  const play = () => {
    if (!audioRef.current)
      return

    // Reset the audio to start if it's already playing
    audioRef.current.currentTime = 0
    audioRef.current.play().catch(logger.error)
  }

  const pause = () => {
    if (!audioRef.current)
      return

    audioRef.current.pause()
  }

  const stop = () => {
    if (!audioRef.current)
      return

    audioRef.current.pause()
    audioRef.current.currentTime = 0
  }

  return { play, pause, stop }
}
