import { SpookyLink } from '../common/SpookyLink'
import { Version } from './Version'

interface FooterLink {
  text: string
  href: string
}

const footerLinks: FooterLink[] = [
  { text: 'New Haunting', href: '/new' },
  { text: 'Explore Archives', href: '/explore' },
] as const

export function SpookyFooter() {
  return (
    <footer className="w-full mt-20 py-6 border-t border-purple-800/30">
      <nav className="container mx-auto px-4">
        <ul className="flex gap-6 justify-center items-center animate-fade-in-up motion-safe:animate-duration-700">
          {footerLinks.map((link) => (
            <li key={link.text}>
              <SpookyLink href={link.href}>{link.text}</SpookyLink>
            </li>
          ))}
        </ul>
        <Version />
      </nav>
    </footer>
  )
}
