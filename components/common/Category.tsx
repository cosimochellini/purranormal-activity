import type { IconProps } from '@tabler/icons-react'
import type { Categories } from '../../data/enum/category'
import dynamic from 'next/dynamic'
import { memo } from 'react'

interface CategoryProps {
  category: Categories
  iconOnly?: boolean
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

function CategoryComponent({ category, iconOnly = false }: CategoryProps) {
  const Icon = categoryIcons[category]

  return (
    <button
      key={category}
      type="button"
      className="group flex items-center space-x-2 rounded-full bg-purple-800/40 px-4 py-2 text-sm text-purple-200 transition-transform hover:scale-105 hover:bg-purple-700/60 focus:outline-none focus:ring-2 focus:ring-purple-400"
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

export const Category = memo(CategoryComponent)
