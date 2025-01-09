import { SpookyBackground } from '@/components/background/SpookyBackground'
import { EditLogForm } from '@/components/editLog'
import { notFound } from 'next/navigation'
import { getLog } from '../../../services/log'

export const runtime = 'edge'

interface Params {
  id: string
}

interface PageProps {
  params: Promise<Params>
}

export default async function EditLogPage({ params }: PageProps) {
  const entry = await getLog(Number((await params).id))

  if (!entry)
    return notFound()

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
