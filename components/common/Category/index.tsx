import classNames from 'classnames'
import { use } from 'react'
import { getCategories } from '../../../static/promise'

interface CategoryProps {
  category: number
  iconOnly?: boolean
  selected?: boolean
  onClick?: () => void
}

const categoryIconsPromise = import('./Icons').then((module) => module.categoryIcons)

const promises = Promise.all([categoryIconsPromise, getCategories])

export function Category({ category, iconOnly = false, selected, onClick }: CategoryProps) {
  const [categoryIcons, categories] = use(promises)

  const currentCategory = categories.find((c) => c.id === category)
  const Icon =
    categoryIcons[currentCategory?.icon as keyof typeof categoryIcons] ?? categoryIcons.questionMark

  const buttonLabel = selected
    ? `Deselect ${currentCategory?.name} category`
    : `Select ${currentCategory?.name} category`

  return (
    <div className="group/tooltip relative">
      <button
        onClick={onClick}
        key={currentCategory?.id}
        type="button"
        aria-label={buttonLabel}
        aria-pressed={selected}
        className={classNames(
          'group flex items-center space-x-2 rounded-full',
          'px-4 py-2 text-sm transition-all duration-300',
          'hover:scale-105 focus:outline-hidden focus:ring-2 focus:ring-purple-400',
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
          <div
            className={classNames(
              'absolute inset-0 rounded-full blur-xl',
              selected ? 'animate-pulse bg-purple-400/20' : 'animate-pulse bg-purple-500/10',
            )}
          />
        </div>
        {!iconOnly && (
          <span className={classNames('transition-all duration-300', selected && 'font-medium')}>
            {currentCategory?.name}
          </span>
        )}
      </button>

      {/* Tooltip */}
      <div
        className={classNames(
          'absolute -top-12 left-1/2 -translate-x-1/2 px-3 py-2',
          'rounded-lg bg-purple-900/90 backdrop-blur-xs',
          'border border-purple-400/30',
          'text-sm text-purple-100 whitespace-nowrap',
          'opacity-0 group-hover/tooltip:opacity-100',
          'transition-all duration-300 pointer-events-none',
          'shadow-[0_0_15px_rgba(168,85,247,0.2)]',
        )}
      >
        {currentCategory?.name}
        {/* Tooltip arrow */}
        <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-purple-900/90 rotate-45 border-r border-b border-purple-400/30" />
      </div>
    </div>
  )
}
