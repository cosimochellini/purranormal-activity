import type { FC } from 'react'
import cn from 'classnames'
import { AnimatedWord } from '../common/AnimatedWord'
import { SpookyButton } from '../common/SpookyButton'

interface HeroSectionProps {
  className?: string
}

export const HeroSection: FC<HeroSectionProps> = ({ className }) => {
  return (
    <section className={cn(
      'text-center max-w-4xl mx-auto px-4',
      'flex flex-col items-center justify-center gap-8',
      className,
    )}
    >
      <h1 className={cn(
        'text-4xl sm:text-6xl md:text-7xl font-magical',
        'flex flex-col sm:flex-row items-center justify-center gap-2',
        'animate-creepy-text',
      )}
      >
        <AnimatedWord text="Paranormal" color="text-white" />
        <AnimatedWord text="Cactivity" />
      </h1>

      <p className={cn(
        'text-base sm:text-lg text-purple-200 max-w-2xl',
        'animate-fade-in-up delay-500 animate-flicker',
      )}
      >
        Document the otherworldly mischief of your supernatural feline companion
      </p>

      <SpookyButton className="mt-2">
        Begin Your Paranormal Log
      </SpookyButton>
    </section>
  )
}
