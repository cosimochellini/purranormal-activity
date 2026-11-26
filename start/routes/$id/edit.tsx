import { createFileRoute, notFound } from '@tanstack/react-router'
import { SpookyBackground } from '@/components/background/SpookyBackground'
import { NotFoundPage } from '@/components/common/NotFoundPage'
import { EditLogForm } from '@/components/editLog'
import { getLogById } from '@/start/services/logs'

export const Route = createFileRoute('/$id/edit')({
  loader: async ({ params }) => {
    const id = Number(params.id)

    if (!Number.isInteger(id) || id <= 0) throw notFound()

    const log = await getLogById({ data: { id } })

    if (!log) throw notFound()

    return log
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: `Edit ${loaderData?.title ?? 'log'} | Paranormal Kitten Logger` },
      { name: 'robots', content: 'noindex' },
    ],
  }),
  notFoundComponent: NotFoundPage,
  component: RouteComponent,
})

function RouteComponent() {
  const entry = Route.useLoaderData()

  return (
    <div className="min-h-screen w-full bg-deep-purple-900 p-4 text-white">
      <SpookyBackground />

      <main className="relative mx-auto flex flex-col items-center justify-center">
        <h1 className="mb-8 text-center text-balance text-4xl font-magical animate-magical-glow">
          Edit Purranormal Activity
        </h1>

        <EditLogForm initialData={entry} />
      </main>
    </div>
  )
}
