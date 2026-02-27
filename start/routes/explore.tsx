import { createFileRoute } from '@tanstack/react-router'
import { Suspense } from 'react'
import { SpookyBackground } from '@/components/background/SpookyBackground'
import { ExploreSection } from '@/components/explore/ExploreSection'
import { ExploreSkeleton } from '@/components/explore/ExploreSkeleton'
import { APP_URL } from '@/env/public'

const EXPLORE_TITLE = 'Explore | Paranormal Kitten Logger'
const EXPLORE_DESCRIPTION = 'Explore the paranormal records of our enchanted encounters...'

export const Route = createFileRoute('/explore')({
  head: () => ({
    meta: [
      { title: EXPLORE_TITLE },
      { name: 'description', content: EXPLORE_DESCRIPTION },
      { property: 'og:title', content: EXPLORE_TITLE },
      { property: 'og:description', content: EXPLORE_DESCRIPTION },
      { property: 'og:type', content: 'website' },
      { property: 'og:url', content: `${APP_URL}/explore` },
      { name: 'twitter:card', content: 'summary' },
      { name: 'twitter:title', content: EXPLORE_TITLE },
      { name: 'twitter:description', content: EXPLORE_DESCRIPTION },
    ],
    links: [{ rel: 'canonical', href: `${APP_URL}/explore` }],
  }),
  component: RouteComponent,
})

function RouteComponent() {
  return (
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
  )
}
