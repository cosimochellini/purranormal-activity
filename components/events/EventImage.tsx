'use client'

import BugImage from '@/images/bug.jpg'
import Image from 'next/image'
import { useState } from 'react'

interface EventImageProps {
  imageUrl: string
  imageAlt: string
}

export function EventImage({ imageUrl, imageAlt }: EventImageProps) {
  const [imageSrc, setImageSrc] = useState(imageUrl)

  return (
    <Image
      src={imageSrc}
      alt={imageAlt}
      width={240}
      height={240}
      className="mb-4 group-hover:animate-spooky-shake rounded-md"
      loading="lazy"
      onError={() => setImageSrc(BugImage.src)}
    />
  )
}
