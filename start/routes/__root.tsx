import { createRootRoute, HeadContent, Outlet, Scripts } from '@tanstack/react-router'
import { NuqsAdapter } from 'nuqs/adapters/tanstack-router'
import { FloatingMenu } from '@/components/common/FloatingMenu'
import { NotFoundPage } from '@/components/common/NotFoundPage'
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
    ],
  }),
  notFoundComponent: NotFoundPage,
  component: RootComponent,
})

function RootComponent() {
  return (
    <html lang="en" className="h-full scrollbar-hidden" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body
        className="min-h-full w-full bg-linear-to-b from-midnight-blue to-deep-purple text-ghost-white antialiased"
        suppressHydrationWarning
      >
        <NuqsAdapter>
          <FloatingMenu />
          <Outlet />
        </NuqsAdapter>
        <Scripts />
      </body>
    </html>
  )
}
