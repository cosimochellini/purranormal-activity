import { SpookyBackground } from '@/components/background/SpookyBackground'
import { ExploreSection } from '@/components/explore/ExploreSection'
import { ExploreSkeleton } from '@/components/explore/ExploreSkeleton'
import { Suspense } from 'react'

export const revalidate = 60

export default function ExplorePage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-deep-purple-900 p-8 pb-20 text-white sm:p-20">
      <SpookyBackground />

      <main className="relative mx-auto flex max-w-7xl flex-col items-center gap-8">
        <div className="text-center">
          <h1 className="mb-4 text-4xl font-magical animate-magical-glow">
            Paranormal Archives
          </h1>
          <p className="text-purple-200/80">
            Delve into the mystical records of our enchanted encounters...
          </p>
        </div>

        <Suspense fallback={<ExploreSkeleton />}>
          <ExploreSection />
        </Suspense>
      </main>
    </div>
  )
}
