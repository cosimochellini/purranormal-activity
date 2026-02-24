import { createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { SpookyBackground } from '@/components/background/SpookyBackground'
import { InfiniteEvents } from '@/components/events/InfiniteEvents'
import { SpookyFooter } from '@/components/footer/SpookyFooter'
import { HeroSection } from '@/components/hero/HeroSection'
import { getLogs } from '@/services/log'

const LIMIT = 6 * 3

const getRecentLogs = createServerFn({ method: 'GET' }).handler(async () => {
  return getLogs({ skip: 0, limit: LIMIT })
})

export const Route = createFileRoute('/')({
  loader: () => getRecentLogs(),
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
          <InfiniteEvents initialLogs={logs} initialLimit={LIMIT} />
        </section>
      </main>

      <SpookyFooter />
    </div>
  )
}
