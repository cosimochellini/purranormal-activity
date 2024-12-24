import type { Categories } from '../../data/enum/category'
import { SpookyBackground } from '@/components/background/SpookyBackground'
import { log } from '@/db/schema'
import { db } from '@/drizzle'
import { eq } from 'drizzle-orm'
import { notFound } from 'next/navigation'

interface PageProps {
  params: Promise<{ id: number }>
}

export const runtime = 'edge'

async function getLog(id: number) {
  const [logEntry] = await db
    .select()
    .from(log)
    .where(eq(log.id, id))

  return logEntry
}

export default async function LogPage({ params }: PageProps) {
  const id = Number((await params).id)

  if (Number.isNaN(id))
    notFound()

  const entry = await getLog(id)

  if (!entry)
    notFound()

  const { categories: rawCategories, description, title } = entry

  const categories = JSON.parse(rawCategories) as Categories[]

  return (
    <div className="relative min-h-screen bg-deep-purple-900 p-4 xs:p-1 text-white">
      <SpookyBackground />

      <main className="relative mx-auto max-w-4xl p-6">
        <div className="animate-fade-in-up space-y-8 rounded-2xl border border-purple-700/30 bg-purple-900/30 p-6 md:p-8 backdrop-blur-sm">
          <div className="space-y-4">
            <code className="text-purple-200/80 text-sm">
              DAY #
              {id * 2}
            </code>
            <h1 className="font-magical text-3xl animate-magical-glow text-balance">
              {title}
            </h1>

            <p className="text-purple-200/80 leading-relaxed text-balance">
              {description}
            </p>
          </div>

          <div className="space-y-2">
            <h2 className="text-xl font-magical text-purple-300">
              Paranormal Categories
            </h2>
            <div className="flex flex-wrap gap-2">
              {categories.map(category => (
                <span
                  key={category}
                  className="rounded-full bg-purple-800/40 px-4 py-1 text-sm text-purple-200"
                >
                  {category}
                </span>
              ))}
            </div>
          </div>

          {/* Decorative elements */}
          <div className="absolute -top-4 left-1/4 h-2 w-2 animate-sparkle rounded-full bg-purple-300/80 blur-[1px]" />
          <div className="absolute -bottom-2 right-1/3 h-2 w-2 animate-sparkle delay-300 rounded-full bg-purple-300/80 blur-[1px]" />
        </div>
      </main>
    </div>
  )
}
