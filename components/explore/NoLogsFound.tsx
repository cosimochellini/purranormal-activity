import Image from 'next/image'
import { randomImage } from '../../images/noResults'

export function NoLogsFound() {
  const image = randomImage()
  return (
    <div className="relative flex flex-col items-center justify-center py-16 px-4">
      {/* Magical glow effects */}
      <div className="absolute inset-0 -m-4 animate-pulse rounded-xl bg-purple-500/10 blur-2xl" />
      <div className="absolute inset-0 -m-2 animate-pulse delay-300 rounded-xl bg-purple-600/5 blur-xl" />

      {/* Sparkles */}
      <div className="absolute -top-4 left-1/4 h-2 w-2 animate-sparkle rounded-full bg-purple-300/80 blur-[1px]" />
      <div className="absolute -bottom-2 right-1/3 h-2 w-2 animate-sparkle delay-300 rounded-full bg-purple-300/80 blur-[1px]" />
      <div className="absolute top-1/2 -right-4 h-2 w-2 animate-sparkle delay-700 rounded-full bg-purple-300/80 blur-[1px]" />

      <div className="relative w-full max-w-md aspect-square mx-auto mb-6">
        <Image
          src={image}
          alt="No supernatural events found"
          className="object-contain transition-transform duration-700 hover:scale-105 rounded-xl"
          priority
          fill
        />
      </div>

      <div className="relative space-y-4 text-center">
        <h2 className="text-2xl font-magical animate-magical-glow">No Mystical Mischief Found</h2>
        <p className="text-balance text-lg text-purple-200/80 max-w-md mx-auto">
          Our magical kitten hasn&apos;t caused any supernatural events matching your criteria...
          yet!
        </p>
      </div>
    </div>
  )
}
