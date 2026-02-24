'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { UI_CONFIG } from '@/constants'
import { LogStatus } from '@/data/enum/logStatus'
import type { LogWithCategories } from '@/db/schema'
import Bug from '@/images/bug.jpg'
import { randomImage } from '@/images/loading'
import { publicImage } from '@/utils/cloudflare'
import { randomItem } from '../../utils/random'

interface ImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  priority?: boolean
  quality?: number
}

interface EventImageProps extends ImageProps {
  log: LogWithCategories
}

const magicalTexts = [
  'Teaching AI to paint with ghost whiskers...',
  'Asking the digital spirits for kitten art...',
  'Brewing pixels in a magical cauldron...',
  'Convincing robots to draw cute paranormal cats...',
  'Summoning AI wizards for spooky artwork...',
  'Training neural networks to see ghost kitties...',
  'Mixing code with catnip for better results...',
  'Whispering sweet prompts to the AI oracle...',
  'Feeding treats to hungry image algorithms...',
  'Casting spells on silicon for mystical art...',
  'Consulting the ancient GPUs of wisdom...',
  'Bribing AI with virtual fish for cat pics...',
  'Enchanting processors with feline magic...',
  'Teaching machines the art of purranormal...',
  'Summoning digital familiars for assistance...',
]

const randomMagicalText = () => randomItem(magicalTexts)

const toAssetSrc = (asset: string | { src: string }) =>
  typeof asset === 'string' ? asset : asset.src

const MagicalLoadingOverlay = () => {
  const [elapsedTime, setElapsedTime] = useState(0)
  const [magicalText, setMagicalText] = useState(randomMagicalText())

  // Timer effect for when image is being created
  useEffect(() => {
    const interval = setInterval(() => {
      setElapsedTime((prev) => prev + 1)
    }, 1000)

    return () => clearInterval(interval)
  }, [])

  // Change magical text every 5 seconds
  useEffect(() => {
    const textInterval = setInterval(() => {
      setMagicalText(randomMagicalText())
    }, 5000)

    return () => clearInterval(textInterval)
  }, [])

  const getProgressPercentage = (seconds: number) => {
    // Progress from 0% to 100% over configured duration
    const percentage = Math.min(
      UI_CONFIG.MAX_PERCENTAGE,
      (seconds / UI_CONFIG.PROGRESS_DURATION_SECONDS) * UI_CONFIG.MAX_PERCENTAGE,
    )
    return percentage
  }

  return (
    <div className="absolute bottom-0 left-0 right-0 bg-black/60 backdrop-blur-xs rounded-b-lg p-2">
      {/* Magical Progress Container */}
      <div className="w-full mx-auto">
        {/* Progress Bar Background */}
        <div className="relative h-1.5 bg-black/40 rounded-full border border-white/20 overflow-hidden mb-2">
          {/* Magical Progress Fill */}
          <div
            className="h-full bg-linear-to-r from-purple-400 via-pink-400 to-blue-400 rounded-full shadow-lg transition-all duration-1000 ease-out relative"
            style={{ width: `${getProgressPercentage(elapsedTime)}%` }}
          >
            {/* Animated sparkles */}
            <div className="absolute inset-0 bg-linear-to-r from-transparent via-white/30 to-transparent animate-pulse" />
            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-1 bg-white rounded-full animate-ping" />
          </div>
        </div>

        {/* Magical Text */}
        <div className="text-center">
          <div className="text-xs text-white/90 font-medium">
            <span>✨</span>
            <span className="ml-1">{magicalText}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

const fallbackImage = randomImage()

export function EventImage({ log, ...props }: Omit<EventImageProps, 'src' | 'alt'>) {
  const clickCounter = useRef(0)

  const [imageError, setImageError] = useState(false)

  const { imageDescription, id, status } = log

  const image = useMemo(() => {
    if (status === LogStatus.Created) return toAssetSrc(fallbackImage)

    if (status === LogStatus.Error) return toAssetSrc(Bug)

    if (imageError) return toAssetSrc(Bug)

    return publicImage(id)
  }, [id, imageError, status])

  const onImageError = () => {
    setImageError(true)
  }

  const onImageClick = () => {
    clickCounter.current += 1

    if (clickCounter.current >= 5) {
      window.location.href = `/${log.id}/edit`
    }
  }

  const {
    priority,
    quality: _quality,
    loading,
    ...imageProps
  } = props as Omit<EventImageProps, 'src' | 'alt'>

  return (
    <div className="relative">
      {/* biome-ignore lint/performance/noImgElement: using plain img during Next to Start migration */}
      <img
        {...(imageProps as React.ImgHTMLAttributes<HTMLImageElement>)}
        src={image}
        alt={imageDescription ?? ''}
        loading={priority ? 'eager' : loading}
        onError={onImageError}
        onMouseDown={onImageClick}
      />

      {status === LogStatus.Created && <MagicalLoadingOverlay />}
    </div>
  )
}
