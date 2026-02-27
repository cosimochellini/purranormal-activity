import { createFileRoute } from '@tanstack/react-router'
import { SpookyBackground } from '@/components/background/SpookyBackground'
import { NewLogForm } from '@/components/newLog'
import { APP_URL } from '@/env/public'

const NEW_TITLE = 'New Log | Paranormal Kitten Logger'
const NEW_DESCRIPTION = 'Record a new supernatural event from your enchanted kitten companion.'

export const Route = createFileRoute('/new')({
  head: () => ({
    meta: [
      { title: NEW_TITLE },
      { name: 'description', content: NEW_DESCRIPTION },
      { property: 'og:title', content: NEW_TITLE },
      { property: 'og:description', content: NEW_DESCRIPTION },
      { property: 'og:type', content: 'website' },
      { property: 'og:url', content: `${APP_URL}/new` },
      { name: 'twitter:card', content: 'summary' },
      { name: 'twitter:title', content: NEW_TITLE },
      { name: 'twitter:description', content: NEW_DESCRIPTION },
    ],
    links: [{ rel: 'canonical', href: `${APP_URL}/new` }],
  }),
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <div className="min-h-screen w-full bg-deep-purple-900 p-4 text-white">
      <SpookyBackground />

      <main className="relative mx-auto flex flex-col items-center justify-center">
        <h1 className="mb-8 text-center text-balance text-4xl font-magical animate-magical-glow">
          Record New Purranormal Activity
        </h1>

        <NewLogForm />
      </main>
    </div>
  )
}
