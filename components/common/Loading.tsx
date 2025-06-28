import Image from 'next/image'
import LoadingImage from '@/images/loading.webp'

export function Loading() {
  return (
    <div className="flex justify-center items-center min-h-96">
      <Image
        src={LoadingImage}
        blurDataURL={LoadingImage.blurDataURL}
        placeholder="blur"
        priority
        height={140}
        width={140}
        alt="Loading..."
        className="w-40 h-40 animate-spin-slow rounded-full shadow-lg shadow-purple-500/50 transition-transform duration-500"
      />
    </div>
  )
}
