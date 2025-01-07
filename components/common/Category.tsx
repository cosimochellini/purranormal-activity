import type { Categories } from '@/data/enum/category'
import type { IconProps } from '@tabler/icons-react'
import classNames from 'classnames'
import dynamic from 'next/dynamic'

interface CategoryProps {
  category: Categories
  iconOnly?: boolean
  selected?: boolean
  onClick?: () => void
}

const categoryIcons = {
  AbsurdCoincidences: dynamic(() => import('@tabler/icons-react').then(mod => mod.IconAlien)),
  PerfectTiming: dynamic(() => import('@tabler/icons-react').then(mod => mod.IconClock)),
  AlwaysRight: dynamic(() => import('@tabler/icons-react').then(mod => mod.IconCheck)),
  PremonitoryDreams: dynamic(() => import('@tabler/icons-react').then(mod => mod.IconMoon)),
  SpectralMischief: dynamic(() => import('@tabler/icons-react').then(mod => mod.IconGhost)),
  WitchyFood: dynamic(() => import('@tabler/icons-react').then(mod => mod.IconChessKnightFilled)),
} as const satisfies Record<Categories, React.ComponentType<IconProps>>

function normalizer(category: string) {
  return category
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, str => str.toUpperCase())
    .trim()
}

export function Category({ category, iconOnly = false, selected, onClick }: CategoryProps) {
  const Icon = categoryIcons[category]

  return (
    <button
      onClick={onClick}
      key={category}
      type="button"
      className={classNames(
        'group flex items-center space-x-2 rounded-full ',
        'bg-purple-800/40 px-4 py-2 text-sm text-purple-200 transition-transform ',
        'hover:scale-105 hover:bg-purple-700/60 focus:outline-none focus:ring-2 focus:ring-purple-400',
        selected && 'bg-purple-400/70',
      )}
    >
      <div className="relative">
        <Icon className="h-5 w-5 text-purple-200 group-hover:animate-spin-slow" />
        <div className="absolute inset-0 animate-pulse rounded-full bg-purple-500/10 blur-xl" />
        <div className="absolute inset-0 animate-pulse delay-300 rounded-full bg-purple-600/5 blur-lg" />
      </div>
      {!iconOnly && <span>{normalizer(category)}</span>}
    </button>
  )
}
