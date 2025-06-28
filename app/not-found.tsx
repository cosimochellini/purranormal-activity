import Image from 'next/image'
import { SpookyBackground } from '@/components/background/SpookyBackground'
import { SpookyButton } from '@/components/common/SpookyButton'
import { randomImage } from '@/images/notFound'
import { SpookyLink } from '../components/common/SpookyLink'

export default function NotFound() {
  const errorImage = randomImage()

  return (
    <div className="min-h-screen w-full bg-deep-purple-900 flex flex-col items-center justify-center p-4">
      <SpookyBackground />

      <main className="relative mx-auto flex max-w-2xl flex-col items-center justify-center gap-8 pt-20 text-center">
        <h1 className="text-balance text-6xl font-magical animate-magical-glow">
          <code>404</code>
        </h1>

        <p className="text-balance text-xl text-purple-200/80">
          Oh my! It seems our magical kitten has made this page disappear into the ethereal realm.
        </p>

        <div className="relative w-full aspect-square max-w-md mx-auto">
          {/* Magical glow effects */}
          <div className="absolute inset-0 -m-4 animate-pulse rounded-xl bg-purple-500/10 blur-2xl" />
          <div className="absolute inset-0 -m-2 animate-pulse delay-300 rounded-xl bg-purple-600/5 blur-xl" />

          {/* Sparkles */}
          <div className="absolute -top-4 left-1/4 h-2 w-2 animate-sparkle rounded-full bg-purple-300/80 blur-[1px]" />
          <div className="absolute -bottom-2 right-1/3 h-2 w-2 animate-sparkle delay-300 rounded-full bg-purple-300/80 blur-[1px]" />

          <Image
            src={errorImage}
            alt="404 Error"
            className="rounded-lg object-contain"
            priority
            fill
          />
        </div>

        <SpookyLink href="/" prefetch>
          <SpookyButton>Return to Safety</SpookyButton>
        </SpookyLink>
      </main>
    </div>
  )
}
