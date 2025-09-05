import cn from 'classnames'
import Image from 'next/image'
import type { FC } from 'react'
import heroImage from '@/images/hero.webp'
import { AnimatedWord } from '../common/AnimatedWord'
import { SpookyButton } from '../common/SpookyButton'
import { SpookyLink } from '../common/SpookyLink'

interface HeroSectionProps {
  className?: string
}

export const HeroSection: FC<HeroSectionProps> = ({ className }) => {
  return (
    <section
      className={cn(
        'text-center max-w-4xl mx-auto px-4',
        'flex flex-col items-center justify-center gap-8',
        className,
      )}
    >
      <h1
        className={cn(
          'text-4xl sm:text-6xl md:text-7xl font-magical',
          'flex flex-col sm:flex-row items-center justify-center gap-2',
          'animate-creepy-text',
        )}
      >
        <AnimatedWord text="Purranormal" color="text-white" />
        <AnimatedWord text="Activity" />
      </h1>

      <div className="group relative w-full aspect-square max-w-3xl mx-auto">
        {/* Magical glow effects */}
        <div className="absolute inset-0 -m-4 animate-pulse rounded-xl bg-purple-500/10 blur-2xl" />
        <div className="absolute inset-0 -m-2 animate-pulse delay-300 rounded-xl bg-purple-600/5 blur-xl" />

        {/* Sparkles */}
        <div className="absolute -top-4 left-1/4 h-2 w-2 animate-sparkle rounded-full bg-purple-300/80 blur-[1px]" />
        <div className="absolute -bottom-2 right-1/3 h-2 w-2 animate-sparkle delay-300 rounded-full bg-purple-300/80 blur-[1px]" />
        <div className="absolute top-1/2 -right-4 h-2 w-2 animate-sparkle delay-700 rounded-full bg-purple-300/80 blur-[1px]" />

        {/* Main image */}
        <div className="relative h-full w-full overflow-hidden rounded-lg">
          <Image
            src={heroImage}
            alt="Magical kitten and frightened chick"
            fill
            priority
            className="animate-fade-in rounded-lg object-cover transition-transform duration-700 group-hover:scale-105"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 80vw, 1200px"
          />

          {/* Hover glow effect */}
          <div className="absolute inset-0 rounded-lg bg-linear-to-tr from-purple-500/10 to-transparent opacity-0 transition-opacity duration-700 group-hover:opacity-100" />
        </div>
      </div>

      <SpookyLink href="/new" prefetch>
        <SpookyButton className="mt-2">Add yet another log</SpookyButton>
      </SpookyLink>
    </section>
  )
}
