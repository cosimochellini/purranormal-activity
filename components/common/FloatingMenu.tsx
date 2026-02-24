'use client'

import { IconCat, IconCrystalBall, IconMenu2, IconSearch } from '@tabler/icons-react'
import cn from 'classnames'
import type { ReactNode } from 'react'
import { memo, useState } from 'react'
import { TransitionLink } from './TransitionLink'

interface MenuItem {
  href: string
  icon: ReactNode
  label: string
}

const menuItems = [
  { href: '/', icon: <IconCat />, label: 'Home' },
  { href: '/new', icon: <IconSearch />, label: 'New' },
  { href: '/explore', icon: <IconCrystalBall />, label: 'Explore' },
] as const satisfies MenuItem[]

const buttonStyles = {
  base: [
    'relative flex items-center justify-center rounded-full',
    'bg-linear-to-br from-deep-purple via-midnight-blue to-deep-purple',
    'text-ghost-white',
    'transition-all duration-500 ease-out',
    'focus:ring-2 focus:ring-neon-green/20 focus:ring-offset-2 focus:ring-offset-deep-purple/50',
    'focus:shadow-lg focus:shadow-neon-green/30',
  ],
  glow: [
    'before:absolute before:inset-0 before:rounded-full',
    'before:bg-linear-to-br before:from-neon-green/20 before:via-transparent before:to-transparent',
    'before:opacity-0 hover:before:opacity-100 before:transition-opacity before:duration-500',
  ],
  size: 'h-14 w-14',
} as const

const menuStyles = {
  container: [
    'absolute left-0 w-48',
    'space-y-4',
    'transition-all duration-500',
    'sm:top-20 top-16',
  ],
  link: [
    'group flex items-center gap-3 rounded-full px-4 py-3',
    'bg-linear-to-br from-midnight-blue via-deep-purple to-midnight-blue',
    'text-ghost-white shadow-lg backdrop-blur-lg',
    'ring-2 ring-neon-green/10 ring-offset-2 ring-offset-deep-purple/50',
    'hover:shadow-neon-green/30 hover:ring-neon-green/30',
    'transition-all duration-500 ease-out hover:translate-x-2',
    'relative overflow-hidden',
  ],
  icon: ['h-5 w-5 transition-transform duration-500', 'group-hover:animate-spin-slow'],
} as const

interface MenuItemProps extends MenuItem {
  isOpen: boolean
  index: number
}

const MenuItemComponent = memo(({ href, icon: Icon, label, isOpen, index }: MenuItemProps) => {
  return (
    <TransitionLink
      href={href}
      className={cn(menuStyles.link, buttonStyles.glow)}
      style={{
        transitionDelay: `${index * 100}ms`,
        opacity: isOpen ? 1 : 0,
        transform: `translateX(${isOpen ? 0 : -20}px)`,
      }}
    >
      <span className="relative z-10 flex items-center gap-3">
        {Icon}
        <span className="font-medium">{label}</span>
      </span>

      <div
        className="absolute inset-0 -z-10 animate-pulse rounded-full bg-purple-500/10 blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"
        aria-hidden="true"
      />
    </TransitionLink>
  )
})

export function FloatingMenu() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <nav className="fixed left-4 top-4 sm:left-6 sm:top-6 z-50" aria-label="Main navigation">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-controls="main-menu"
        aria-label="Toggle menu"
        className={cn(buttonStyles.base, buttonStyles.glow, buttonStyles.size)}
      >
        <IconMenu2
          className={cn('h-6 w-6 transition-transform duration-500', { 'rotate-90': isOpen })}
        />
      </button>

      <div
        id="main-menu"
        className={cn(
          menuStyles.container,
          isOpen ? 'opacity-100 translate-x-0' : 'opacity-0 pointer-events-none -translate-x-4',
        )}
      >
        {menuItems.map((item, index) => (
          <MenuItemComponent key={item.label} {...item} isOpen={isOpen} index={index} />
        ))}
      </div>
    </nav>
  )
}
