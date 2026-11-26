import { createFileRoute } from '@tanstack/react-router'
import { SpookyBackground } from '@/components/background/SpookyBackground'
import { InfiniteEvents } from '@/components/events/InfiniteEvents'
import { SpookyFooter } from '@/components/footer/SpookyFooter'
import { HeroSection } from '@/components/hero/HeroSection'
import { APP_URL } from '@/env/public'
import { getRecentLogs, HOME_PAGE_SIZE } from '@/start/services/logs'
import { pageCacheControl } from '@/utils/cacheControl'

const HOME_TITLE = 'Paranormal Kitten Logger'
const HOME_DESCRIPTION = 'Track the magical mishaps and spooky shenanigans of your enchanted kitten'

export const Route = createFileRoute('/')({
  head: () => ({
    meta: [
      { title: HOME_TITLE },
      { name: 'description', content: HOME_DESCRIPTION },
      { property: 'og:title', content: HOME_TITLE },
      { property: 'og:description', content: HOME_DESCRIPTION },
      { property: 'og:type', content: 'website' },
      { property: 'og:url', content: `${APP_URL}/` },
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:title', content: HOME_TITLE },
      { name: 'twitter:description', content: HOME_DESCRIPTION },
    ],
    links: [{ rel: 'canonical', href: `${APP_URL}/` }],
  }),
  loader: () => getRecentLogs(),
  // `getRecentLogs` turns a DB failure into `[]`: never cache an empty list.
  headers: ({ loaderData, matches }) => pageCacheControl(!!loaderData?.length, matches),
  component: RouteComponent,
})

function RouteComponent() {
  const logs = Route.useLoaderData()

  return (
    <div className="relative min-h-screen overflow-hidden bg-deep-purple-900 p-8 pb-20 text-white sm:p-20">
      <SpookyBackground />

      <main className="relative flex flex-col items-center gap-12">
        <HeroSection />

        <section className="w-full max-w-5xl">
          <h2 className="mb-6 text-2xl font-magical animate-ghost">
            Recent Supernatural Sightings
          </h2>
          <InfiniteEvents initialLogs={logs} initialLimit={HOME_PAGE_SIZE} />
        </section>
      </main>

      <SpookyFooter />
    </div>
  )
}
