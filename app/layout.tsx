import type { Metadata, Viewport } from 'next'
import { Caveat, Quicksand } from 'next/font/google'
import './globals.css'

const primaryFont = Quicksand({
  subsets: ['latin'],
  variable: '--font-primary',
})

const accentFont = Caveat({
  subsets: ['latin'],
  variable: '--font-accent',
})

export const metadata: Metadata = {
  title: 'Paranormal Kitten Logger',
  description: 'Track the magical mishaps and spooky shenanigans of your enchanted kitten',
  keywords: ['paranormal', 'kitten', 'magical', 'tracking', 'spooky'],
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
} satisfies Viewport

interface RootLayoutProps {
  children: React.ReactNode
}

function RootLayout({ children }: Readonly<RootLayoutProps>) {
  return (
    <html lang="en">
      <body
        className={`${primaryFont.variable} ${accentFont.variable}
          min-h-screen bg-gradient-to-b from-midnight-blue to-deep-purple
          text-ghost-white antialiased`}
      >
        {children}
      </body>
    </html>
  )
}

export default RootLayout
