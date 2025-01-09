import type { CSSProperties } from 'react'
import type { GetResponse } from '../../app/api/categories/route'
import type { Category } from '../../db/schema'
import { use } from 'react'
import { range } from '../../utils/array'
import { fetcher } from '../../utils/fetch'
import { Category as CategoryComponent } from '../common/Category'

interface CategorySelectorProps {
  selected: Category[]
  onChange: (categories: Category[]) => void
  styles?: CSSProperties
}

const getCategories = fetcher<GetResponse>('/api/categories')()

export function CategorySelector({ selected, onChange, styles }: CategorySelectorProps) {
  const categories = use(getCategories)
  const selectedIds = selected.map(c => c.id)

  const toggleCategory = (category: Category) => {
    const newCategories = selectedIds.includes(category.id)
      ? selected.filter(c => c.id !== category.id)
      : [...selected, category]

    onChange(newCategories)
  }

  return (
    <div className="space-y-2" style={styles}>
      <label className="block text-sm font-medium text-purple-200">
        Categories
      </label>
      <div className="flex flex-wrap gap-2">
        {categories.map(category => (
          <CategoryComponent
            key={category.id}
            category={category}
            selected={selectedIds.includes(category.id)}
            onClick={() => toggleCategory(category)}
          />
        ))}
      </div>
    </div>
  )
}

CategorySelector.Skeleton = () => (
  <div className="flex flex-wrap gap-2">
    {range(4).map(index => (
      <CategoryComponent
        key={index}
        category={{ id: index, name: '...' } as Category}
        selected={false}
        onClick={() => {}}
      />
    ))}
  </div>
)
