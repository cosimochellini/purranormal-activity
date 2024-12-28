'use client'

import type { Log } from '../../db/schema'
import Bug from '@/images/bug.jpg'
import Image from 'next/image'
import { useEffect, useState } from 'react'
import { LogStatus } from '../../data/enum/logStatus'
import { randomImage } from '../../images/loading'
import { publicImage } from '../../utils/cloudflare'
import { fetcher } from '../../utils/fetch'

type ImageProps = React.ComponentProps<typeof Image>

interface EventImageProps extends ImageProps {
  log: Log
}

const fallbackImage = randomImage()

export function EventImage({ log, ...props }: Omit<EventImageProps, 'src' | 'alt'>) {
  const [internalLog, setInternalLog] = useState(log)
  const { imageDescription, id } = internalLog
  const imageUrl = publicImage(id)

  const [imageSrc, setImageSrc] = useState(imageUrl as string)

  useEffect(() => {
    if (internalLog.status !== LogStatus.Created)
      return

    const fetchLog = fetcher<Log>(`/api/log/${internalLog.id}`)
    const timeout = setTimeout(() => {
      fetchLog()
        .then(data => setInternalLog(data))
        .catch(console.error)
    }, 3000)

    return () => clearTimeout(timeout)
  }, [internalLog])

  const onImageError = () => {
    setImageSrc(() => internalLog.status === LogStatus.Created ? fallbackImage.src : Bug.src)
  }

  return (
    <Image
      {...props}
      src={imageSrc}
      alt={imageDescription ?? ''}
      onError={onImageError}
    />
  )
}
