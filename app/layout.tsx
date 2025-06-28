import type { Metadata, Viewport } from 'next'
import { Caveat, Quicksand } from 'next/font/google'
import { ViewTransitions } from 'next-view-transitions'
import { FloatingMenu } from '@/components/common/FloatingMenu'
import './globals.css'

const primaryFont = Quicksand({
  subsets: ['latin'],
  variable: '--font-primary',
})

const accentFont = Caveat({
  subsets: ['latin'],
  variable: '--font-accent',
})

export const metadata = {
  title: 'Paranormal Kitten Logger',
  description: 'Track the magical mishaps and spooky shenanigans of your enchanted kitten',
  keywords: ['paranormal', 'kitten', 'magical', 'tracking', 'spooky'],
} satisfies Metadata

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
} satisfies Viewport

interface RootLayoutProps {
  children: React.ReactNode
}

export default function RootLayout({ children }: Readonly<RootLayoutProps>) {
  return (
    <ViewTransitions>
      <html lang="en" className="h-full scrollbar-hidden">
        <body
          className={`${primaryFont.variable} ${accentFont.variable}
        min-h-full w-full
        bg-gradient-to-b from-midnight-blue to-deep-purple
        text-ghost-white antialiased`}
        >
          <FloatingMenu />
          {children}
        </body>
      </html>
    </ViewTransitions>
  )
}
