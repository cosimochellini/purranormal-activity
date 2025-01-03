import type { CSSProperties } from 'react'
import { Categories } from '@/data/enum/category'
import { typedObjectEntries } from '@/utils/typed'
import cn from 'classnames'

interface CategorySelectorProps {
  selected: Categories[]
  onChange: (categories: Categories[]) => void
  styles?: CSSProperties
}

export function CategorySelector({ selected, onChange, styles }: CategorySelectorProps) {
  const toggleCategory = (category: Categories) => {
    const newCategories = selected.includes(category)
      ? selected.filter(c => c !== category)
      : [...selected, category]

    onChange(newCategories)
  }

  return (
    <div className="space-y-2" style={styles}>
      <label className="block text-sm font-medium text-purple-200">
        Categories
      </label>
      <div className="flex flex-wrap gap-2">
        {typedObjectEntries(Categories).map(([key, category]) => (
          <button
            key={key}
            type="button"
            onClick={() => toggleCategory(category)}
            className={cn(
              'rounded-full px-4 py-2 text-sm transition-colors',
              'border border-purple-700/30',
              selected.includes(category)
                ? 'bg-purple-700/50 text-white'
                : 'bg-purple-900/30 text-purple-300 hover:bg-purple-700/30',
            )}
          >
            {category}
          </button>
        ))}
      </div>
    </div>
  )
}
