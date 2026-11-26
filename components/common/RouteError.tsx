import { type ErrorComponentProps, useRouter } from '@tanstack/react-router'
import { SpookyBackground } from '@/components/background/SpookyBackground'
import { logger } from '@/utils/logger'
import { SpookyButton } from './SpookyButton'
import { SpookyLink } from './SpookyLink'

/**
 * Router-wide error boundary (`defaultErrorComponent`). A loader or render
 * failure lands here instead of a blank page; "Try again" re-runs the loaders.
 */
export function RouteError({ error }: ErrorComponentProps) {
  const router = useRouter()
  logger.error('Route error:', error)

  return (
    <div className="min-h-screen w-full bg-deep-purple-900 flex flex-col items-center justify-center p-4">
      <SpookyBackground />

      <main className="relative mx-auto flex max-w-2xl flex-col items-center justify-center gap-8 pt-20 text-center">
        <h1 className="text-balance text-5xl font-magical animate-magical-glow">
          A spell went wrong
        </h1>

        <p className="text-balance text-xl text-purple-200/80">
          Our magical kitten knocked something over while fetching this page. Give it another try.
        </p>

        <div className="flex gap-4">
          <SpookyButton onClick={() => router.invalidate()}>Try again</SpookyButton>
          <SpookyLink to="/">
            <SpookyButton variant="secondary">Return to Safety</SpookyButton>
          </SpookyLink>
        </div>
      </main>
    </div>
  )
}
