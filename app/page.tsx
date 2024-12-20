import { log } from '../db/schema'
import { db } from '../drizzle'
import { SpookyBackground } from './components/background/SpookyBackground'
import { EventCard } from './components/events/EventCard'
import { SpookyFooter } from './components/footer/SpookyFooter'
import { HeroSection } from './components/hero/HeroSection'

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
  const events = await db.select().from(log)

  return (
    <section className="w-full max-w-5xl animate-fade-in-up delay-1000">
      <h2 className="mb-6 text-2xl font-magical animate-flicker">
        Recent Supernatural Sightings
      </h2>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {events.map(event => (
          <EventCard
            key={event.title}
            title={event.title}
            description={event.description}
          />
        ))}
      </div>
    </section>
  )
}

export default Home
