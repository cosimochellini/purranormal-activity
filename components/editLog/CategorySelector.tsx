import { getRouteApi } from '@tanstack/react-router'
import type { CSSProperties } from 'react'
import { range } from '../../utils/array'
import { Category as CategoryComponent } from '../common/Category'

interface CategorySelectorProps {
  selected: number[]
  onChange: (categories: number[]) => void
  styles?: CSSProperties
  iconsOnly?: boolean
}

const rootRoute = getRouteApi('__root__')

export function CategorySelector({ selected, onChange, styles, iconsOnly }: CategorySelectorProps) {
  const categories = rootRoute.useLoaderData()

  const toggleCategory = (categoryId: number) => {
    const newCategories = selected.includes(categoryId)
      ? selected.filter((c) => c !== categoryId)
      : [...selected, categoryId]

    onChange(newCategories)
  }

  return (
    <div className="space-y-2" style={styles}>
      {/* biome-ignore lint/a11y/noLabelWithoutControl: it's a label */}
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
