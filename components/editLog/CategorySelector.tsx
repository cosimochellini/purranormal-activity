import type { CSSProperties } from 'react'
import { Categories } from '@/data/enum/category'
import { typedObjectEntries } from '@/utils/typed'
import { Category } from '../common/Category'

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
          <Category
            key={key}
            category={category}
            selected={selected.includes(category)}
            onClick={() => toggleCategory(category)}
          />
        ))}
      </div>
    </div>
  )
}
