import type { CSSProperties } from 'react'
import { use } from 'react'
import { getCategories } from '../../static/promise'
import { range } from '../../utils/array'
import { Category as CategoryComponent } from '../common/Category'

interface CategorySelectorProps {
  selected: number[]
  onChange: (categories: number[]) => void
  styles?: CSSProperties
  iconsOnly?: boolean
}

export function CategorySelector({ selected, onChange, styles, iconsOnly }: CategorySelectorProps) {
  const categories = use(getCategories)

  const toggleCategory = (categoryId: number) => {
    const newCategories = selected.includes(categoryId)
      ? selected.filter((c) => c !== categoryId)
      : [...selected, categoryId]

    onChange(newCategories)
  }

  return (
    <div className="space-y-2" style={styles}>
      <label className="block text-sm font-medium text-purple-200">Categories</label>
      <div className="flex flex-wrap gap-2">
        {categories
          .map((x) => x.id)
          .map((category) => (
            <CategoryComponent
              key={category}
              category={category}
              selected={selected.includes(category)}
              onClick={() => toggleCategory(category)}
              iconOnly={iconsOnly}
            />
          ))}
      </div>
    </div>
  )
}

export function CategorySelectorSkeleton() {
  return (
    <div className="flex flex-wrap gap-2">
      {range(4).map((index) => (
        <CategoryComponent key={index} category={index} selected={false} onClick={() => {}} />
      ))}
    </div>
  )
}
