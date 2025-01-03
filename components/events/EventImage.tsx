'use client'

import type { Log } from '../../db/schema'
import Bug from '@/images/bug.jpg'
import { useTransitionRouter } from 'next-view-transitions'
import Image from 'next/image'
import { useEffect, useMemo, useRef, useState } from 'react'
import { LogStatus } from '../../data/enum/logStatus'
import { randomImage } from '../../images/loading'
import { publicImage } from '../../utils/cloudflare'
import { fetcher } from '../../utils/fetch'

type ImageProps = React.ComponentProps<typeof Image>

interface EventImageProps extends ImageProps {
  log: Log
}

const fallbackImage = randomImage()
const fetchLog = fetcher<Log>(`/api/log/[id]`)

export function EventImage({ log, ...props }: Omit<EventImageProps, 'src' | 'alt'>) {
  const interval = useRef<NodeJS.Timeout>(undefined)
  const clickCounter = useRef(0)
  const router = useTransitionRouter()

  const [internalLog, setInternalLog] = useState(log)
  const [imageError, setImageError] = useState(false)

  const { imageDescription, id, status } = internalLog

  const image = useMemo(() => {
    if (status === LogStatus.Created)
      return fallbackImage

    if (status === LogStatus.Error)
      return Bug.src

    if (imageError)
      return Bug.src

    return publicImage(id)
  }, [id, imageError, status])

  useEffect(() => {
    if (status !== LogStatus.Created)
      return clearInterval(interval.current)

    interval.current = setInterval(() => {
      fetchLog({ params: { id } })
        .then(setInternalLog)
        .catch(console.error)
    }, 6000)

    return () => clearInterval(interval.current)
  }, [id, status])

  const onImageError = () => {
    setImageError(true)
  }

  const onImageClick = () => {
    clickCounter.current += 1

    if (clickCounter.current >= 5)
      return router.push(`/${log.id}/edit`)
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
