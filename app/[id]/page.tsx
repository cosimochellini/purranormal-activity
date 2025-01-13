import type { Metadata } from 'next'
import { SpookyBackground } from '@/components/background/SpookyBackground'
import classNames from 'classnames'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { Category } from '../../components/common/Category'
import { EventImage } from '../../components/events/EventImage'
import { Refetch } from '../../components/timer/refetch'
import { LogStatus } from '../../data/enum/logStatus'

import { NEXT_PUBLIC_APP_URL } from '../../env/next'
import { getLog } from '../../services/log'
import { publicImage } from '../../utils/cloudflare'
import { transitions } from '../../utils/viewTransition'

interface Params {
  id: string
}

interface PageProps {
  params: Promise<Params>
}

export const runtime = 'edge'

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const rawId = (await params).id

  const entry = await getLog(Number(rawId))

  if (!entry) {
    return {}
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
          url: publicImage(id),
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
  const log = await getLog(Number(rawId))

  if (!log)
    return notFound()

  const { description, title, id, status } = log
  const styles = transitions(id)

  return (
    <div className="relative min-h-full bg-deep-purple-900 p-1 md:p-4 text-white">
      <Refetch interval={5000} shouldRefetch={status === LogStatus.Created} />

      <SpookyBackground />

      <main className="relative mx-auto max-w-4xl p-6">
        <div
          className={classNames(
            'space-y-8 rounded-2xl border border-purple-700/30 bg-purple-900/30 p-6 md:p-8 backdrop-blur-sm',
          )}
        >
          <div className="space-y-4">
            <code className="text-purple-200/80 text-sm">
              DAY #
              {id * 2}
            </code>

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
            <h2 className="text-xl font-magical text-purple-300">
              Paranormal Categories
            </h2>
            <div className="flex flex-wrap gap-2" style={styles.categories}>
              <Suspense>
                {log.categories.map(category => (
                  <Category key={category} category={category} />
                ))}
              </Suspense>
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
