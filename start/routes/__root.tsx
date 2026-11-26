import { createRootRoute, HeadContent, Outlet, Scripts } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { FloatingMenu } from '@/components/common/FloatingMenu'
import { NotFoundPage } from '@/components/common/NotFoundPage'
import { getCategories } from '@/start/services/logs'
import '@/start/globals.css'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1, maximum-scale=1',
      },
      {
        title: 'Paranormal Kitten Logger',
      },
      {
        name: 'description',
        content: 'Track the magical mishaps and spooky shenanigans of your enchanted kitten',
      },
      {
        name: 'keywords',
        content: 'paranormal, kitten, magical, tracking, spooky',
      },
      { name: 'theme-color', content: '#1a1025' },
    ],
    links: [{ rel: 'icon', href: '/favicon.ico', sizes: 'any' }],
  }),
  // Categories are read by every page that shows a badge. They only change by
  // hand in the DB; the 5-minute staleTime bounds how long a degraded `[]`
  // (`getCategories` never throws) can stick in a client session.
  loader: () => getCategories(),
  staleTime: 5 * 60_000,
  notFoundComponent: NotFoundPage,
  // The document lives in the shell, which renders even when a root-level
  // error replaces `component`: the error page still gets styles and hydrates.
  shellComponent: RootDocument,
  component: RootComponent,
})

function RootComponent() {
  return (
    <>
      <FloatingMenu />
      <Outlet />
    </>
  )
}

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="h-full scrollbar-hidden" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body
        className="min-h-full w-full bg-linear-to-b from-midnight-blue to-deep-purple text-ghost-white antialiased"
        suppressHydrationWarning
      >
        {children}
        <Scripts />
      </body>
    </html>
  )
}
