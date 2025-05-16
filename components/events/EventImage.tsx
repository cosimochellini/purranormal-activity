'use client'

import { LogStatus } from '@/data/enum/logStatus'
import type { LogWithCategories } from '@/db/schema'
import Bug from '@/images/bug.jpg'
import { randomImage } from '@/images/loading'
import { publicImage } from '@/utils/cloudflare'
import { useTransitionRouter } from 'next-view-transitions'
import Image from 'next/image'
import { useMemo, useRef, useState } from 'react'

type ImageProps = React.ComponentProps<typeof Image>

interface EventImageProps extends ImageProps {
  log: LogWithCategories
}

const fallbackImage = randomImage()

export function EventImage({ log, ...props }: Omit<EventImageProps, 'src' | 'alt'>) {
  const clickCounter = useRef(0)
  const router = useTransitionRouter()

  const [imageError, setImageError] = useState(false)

  const { imageDescription, id, status } = log

  const image = useMemo(() => {
    if (status === LogStatus.Created) return fallbackImage.src

    if (status === LogStatus.Error) return Bug.src

    if (imageError) return Bug.src

    return publicImage(id)
  }, [id, imageError, status])

  const onImageError = () => {
    setImageError(true)
  }

  const onImageClick = () => {
    clickCounter.current += 1

    if (clickCounter.current >= 5) return router.push(`/${log.id}/edit`)
  }

  return (
    <Image
      {...props}
      src={image}
      alt={imageDescription ?? ''}
      onError={onImageError}
      onClick={onImageClick}
    />
  )
}
