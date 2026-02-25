import { createFileRoute, notFound } from '@tanstack/react-router'
import classNames from 'classnames'
import { SpookyBackground } from '@/components/background/SpookyBackground'
import { Category } from '@/components/common/Category'
import { NotFoundPage } from '@/components/common/NotFoundPage'
import { SendNotificationButton } from '@/components/common/SendNotificationButton'
import { EventImage } from '@/components/events/EventImage'
import { TriggerImageGeneration } from '@/components/image/TriggerImageGeneration'
import { APP_URL } from '@/env/public'
import { getLogById } from '@/start/services/log'
import { publicImage } from '@/utils/cloudflare'
import { transitions } from '@/utils/viewTransition'

export const Route = createFileRoute('/$id')({
  loader: async ({ params }) => {
    const id = Number(params.id)

    if (!Number.isFinite(id)) throw notFound()

    const log = await getLogById({ data: { id } })

    if (!log) throw notFound()

    return log
  },
  head: ({ loaderData, params }) => {
    if (!loaderData) {
      return {
        meta: [{ title: 'Not Found' }],
      }
    }

    const { title, description, id } = loaderData

    return {
      meta: [
        { title: `Day ${id * 2} - ${title}` },
        { name: 'description', content: description },
        { property: 'og:title', content: `Day ${id * 2} - ${title}` },
        { property: 'og:description', content: description },
        { property: 'og:type', content: 'article' },
        { property: 'og:url', content: `${APP_URL}/${params.id}` },
        { property: 'og:image', content: publicImage(id) },
        { name: 'twitter:card', content: 'summary_large_image' },
        { name: 'twitter:title', content: `Day ${id * 2} - ${title}` },
        { name: 'twitter:description', content: description },
        { name: 'twitter:image', content: publicImage(id) },
      ],
      links: [{ rel: 'canonical', href: `${APP_URL}/${params.id}` }],
    }
  },
  notFoundComponent: NotFoundPage,
  component: RouteComponent,
})

function RouteComponent() {
  const log = Route.useLoaderData()

  const { description, title, id } = log
  const styles = transitions(id)

  return (
    <div className="relative min-h-full bg-deep-purple-900 p-1 md:p-4 text-white">
      <TriggerImageGeneration log={log} />

      <SpookyBackground />

      <main className="relative mx-auto max-w-4xl p-6">
        <div
          className={classNames(
            'space-y-8 rounded-2xl border border-purple-700/30 bg-purple-900/30 p-6 md:p-8 backdrop-blur-xs',
          )}
        >
          <div className="space-y-4">
            <code className="text-purple-200/80 text-sm">DAY #{id * 2}</code>

            <EventImage
              width={600}
              height={600}
              priority
              className="rounded-lg mx-auto w-full h-auto"
              log={log}
              style={styles.image}
            />

            <h1
              className="font-magical text-3xl animate-magical-glow text-balance"
              style={styles.title}
            >
              {title}
            </h1>

            <p
              className="text-purple-200/80 leading-relaxed text-balance"
              style={styles.description}
            >
              {description}
            </p>
          </div>

          <div className="space-y-2">
            <h2 className="text-xl font-magical text-purple-300">Paranormal Categories</h2>
            <div className="flex flex-wrap gap-2" style={styles.categories}>
              {log.categories.map((category) => (
                <Category key={category} category={category} />
              ))}
            </div>
          </div>

          <div className="absolute -top-4 left-1/4 h-2 w-2 animate-sparkle rounded-full bg-purple-300/80 blur-[1px]" />
          <div className="absolute -bottom-2 right-1/3 h-2 w-2 animate-sparkle delay-300 rounded-full bg-purple-300/80 blur-[1px]" />
        </div>

        <div className="flex justify-center pt-4">
          <SendNotificationButton logId={id} />
        </div>
      </main>
    </div>
  )
}
