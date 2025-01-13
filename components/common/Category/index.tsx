import type { SlimCategory } from '@/db/schema'
import classNames from 'classnames'
import { use } from 'react'

interface CategoryProps {
  category: SlimCategory
  iconOnly?: boolean
  selected?: boolean
  onClick?: () => void
}

const categoryIconsPromise = import('./Icons').then(module => module.categoryIcons)
const emptyIcon = () => null

export function Category({ category, iconOnly = false, selected, onClick }: CategoryProps) {
  const categoryIcons = use(categoryIconsPromise)
  const Icon = categoryIcons[category.icon as keyof typeof categoryIcons] ?? emptyIcon

  const buttonLabel = selected
    ? `Deselect ${category.name} category`
    : `Select ${category.name} category`

  return (
    <button
      onClick={onClick}
      key={category.id}
      type="button"
      aria-label={buttonLabel}
      aria-pressed={selected}
      className={classNames(
        'group flex items-center space-x-2 rounded-full',
        'px-4 py-2 text-sm transition-all duration-300',
        'hover:scale-105 focus:outline-none focus:ring-2 focus:ring-purple-400',
        selected
          ? [
              'bg-purple-500/40 text-white',
              'shadow-[0_0_15px_rgba(168,85,247,0.3)]',
              'border border-purple-400/50',
            ]
          : [
              'bg-purple-800/40 text-purple-200',
              'hover:bg-purple-700/60',
              'border border-transparent',
            ],
      )}
    >
      <div className="relative">
        <Icon
          className={classNames(
            'h-5 w-5 transition-all duration-300',
            selected
              ? 'text-white animate-bounce-slow'
              : 'text-purple-200 group-hover:animate-spin-slow',
          )}
        />
        <div className={classNames(
          'absolute inset-0 rounded-full blur-xl',
          selected
            ? 'animate-pulse bg-purple-400/20'
            : 'animate-pulse bg-purple-500/10',
        )}
        />
      </div>
      {!iconOnly && (
        <span className={classNames(
          'transition-all duration-300',
          selected && 'font-medium',
        )}
        >
          {category.name}
        </span>
      )}
    </button>
  )
}
