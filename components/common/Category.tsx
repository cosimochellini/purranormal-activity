import type { SlimCategory } from '@/db/schema'
import {
  IconAlien,
  IconCheck,
  IconChessKnightFilled,
  IconClock,
  IconGhost,
  IconMoon,
  type IconProps,
  IconQuestionMark,
} from '@tabler/icons-react'
import classNames from 'classnames'

interface CategoryProps {
  category: SlimCategory
  iconOnly?: boolean
  selected?: boolean
  onClick?: () => void
}

const categoryIcons = {
  AbsurdCoincidences: IconAlien,
  PerfectTiming: IconClock,
  AlwaysRight: IconCheck,
  PremonitoryDreams: IconMoon,
  SpectralMischief: IconGhost,
  WitchyFood: IconChessKnightFilled,
} as const satisfies Record<string, React.ComponentType<IconProps>>

export function Category({ category, iconOnly = false, selected, onClick }: CategoryProps) {
  const Icon = categoryIcons[category.icon as keyof typeof categoryIcons] ?? IconQuestionMark

  return (
    <button
      onClick={onClick}
      key={category.id}
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
      {!iconOnly && <span>{category.name}</span>}
    </button>
  )
}
