import type { Metadata } from 'next'
import { NuqsAdapter } from 'nuqs/adapters/next/app'
import { Suspense } from 'react'
import { SpookyBackground } from '@/components/background/SpookyBackground'
import { ExploreSection } from '@/components/explore/ExploreSection'
import { ExploreSkeleton } from '@/components/explore/ExploreSkeleton'

export const revalidate = 60

export const metadata: Metadata = {
  title: 'Explore',
  description: 'Explore the paranormal records of our enchanted encounters...',
}

export default function ExplorePage() {
  return (
    <NuqsAdapter>
      <div className="relative min-h-screen overflow-hidden bg-deep-purple-900 p-8 pb-20 text-white sm:p-20">
        <SpookyBackground />

        <main className="relative mx-auto flex max-w-7xl flex-col items-center gap-8">
          <div className="text-center">
            <h1 className="mb-4 text-4xl font-magical animate-magical-glow">Paranormal Archives</h1>
            <p className="text-purple-200/80">
              Delve into the mystical records of our enchanted encounters...
            </p>
          </div>

          <Suspense fallback={<ExploreSkeleton />}>
            <ExploreSection />
          </Suspense>
        </main>
      </div>
    </NuqsAdapter>
  )
}
