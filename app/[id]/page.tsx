import type { Metadata } from 'next'
import { SpookyBackground } from '@/components/background/SpookyBackground'
import { log } from '@/db/schema'
import { db } from '@/drizzle'
import { eq } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import { Category } from '../../components/common/Category'
import { EventImage } from '../../components/events/EventImage'
import { NEXT_PUBLIC_APP_URL } from '../../env/next'
import { getCategories } from '../../utils/categories'
import { publicImage } from '../../utils/cloudflare'

interface Params {
  id: string
}

interface PageProps {
  params: Promise<Params>
}

export const runtime = 'edge'

async function getLog(id: number) {
  const [logEntry] = await db
    .select()
    .from(log)
    .where(eq(log.id, id))

  return logEntry
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const rawId = (await params).id
  const entry = await getLog(Number(rawId))

  if (!entry) {
    notFound()
  }

  const { title, description, id } = entry

  return {
    title: `Day ${id * 2} - ${title}`,
    description,
    openGraph: {
      title: `Day ${id * 2} - ${title}`,
      description,
      type: 'article',
      url: `${NEXT_PUBLIC_APP_URL}/${rawId}`,
      images: [
        {
          url: publicImage(entry.id), // Assuming entry has an imageUrl field
          width: 800,
          height: 800,
          alt: title,
        },
      ],
    },
  }
}

// eslint-disable-next-line import/no-mutable-exports, prefer-const
export let revalidate = 2 * 60 * 60 // 2 hours

export default async function Page({ params }: PageProps) {
  const rawId = (await params).id
  const entry = await getLog(Number(rawId))

  if (!entry)
    return notFound()

  const { description, title, id } = entry
  const categories = getCategories(entry)

  return (
    <div className="relative min-h-full bg-deep-purple-900 p-1 md:p-4 text-white">
      <SpookyBackground />

      <main className="relative mx-auto max-w-4xl p-6">
        <div className="animate-fade-in-up space-y-8 rounded-2xl border border-purple-700/30 bg-purple-900/30 p-6 md:p-8 backdrop-blur-sm">
          <div className="space-y-4">
            <code className="text-purple-200/80 text-sm">
              DAY #
              {id * 2}
            </code>

            <EventImage
              width={600}
              height={600}
              priority
              className="rounded-lg mx-auto"
              log={entry}
            />

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
                <Category key={category} category={category} />
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
