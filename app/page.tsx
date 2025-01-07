import { SpookyBackground } from '@/components/background/SpookyBackground'
import { InfiniteEvents } from '@/components/events/InfiniteEvents'
import { SpookyFooter } from '@/components/footer/SpookyFooter'
import { HeroSection } from '@/components/hero/HeroSection'

function Home() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-deep-purple-900 p-8 pb-20 text-white sm:p-20">
      <SpookyBackground />

      <main className="relative flex flex-col items-center gap-12">
        <HeroSection />
        <RecentEvents />
      </main>

      <SpookyFooter />
    </div>
  )
}

async function RecentEvents() {
  return (
    <section className="w-full max-w-5xl">
      <h2 className="mb-6 text-2xl font-magical animate-ghost">
        Recent Supernatural Sightings
      </h2>
      <InfiniteEvents />
    </section>
  )
}

export default Home
