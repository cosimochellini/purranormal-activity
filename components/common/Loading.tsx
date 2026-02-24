import LoadingImage from '@/images/loading.webp'

export function Loading() {
  const src = typeof LoadingImage === 'string' ? LoadingImage : LoadingImage.src

  return (
    <div className="flex justify-center items-center min-h-96">
      {/* biome-ignore lint/performance/noImgElement: using plain img during Next to Start migration */}
      <img
        src={src}
        alt="Loading..."
        width={140}
        height={140}
        className="w-40 h-40 animate-spin-slow rounded-full shadow-lg shadow-purple-500/50 transition-transform duration-500"
      />
    </div>
  )
}
