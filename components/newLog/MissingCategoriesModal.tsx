import type { Body, PostResponse } from '../../app/api/categories/route'
import type { Response } from '../../app/api/log/[id]/categories/route'
import { IconCheck, IconX } from '@tabler/icons-react'
import { useState } from 'react'
import { fetcher } from '../../utils/fetch'
import { logger } from '../../utils/logger'
import { SpookyButton } from '../common/SpookyButton'
import { SpookyModal } from '../common/SpookyModal'

interface MissingCategoriesModalProps {
  open: boolean
  logId: number
  onClose: () => void
  missingCategories: string[]
}

const addCategories = fetcher<PostResponse, never, Body>('/api/categories', 'POST')
const addLogCategories = fetcher<Response, never, Body>('/api/log/[id]/categories', 'POST')

export function MissingCategoriesModal({
  open,
  logId,
  onClose,
  missingCategories,
}: MissingCategoriesModalProps) {
  const [selectedCategories, setSelectedCategories] = useState(() =>
    missingCategories.map(category => ({ category, selected: false })),
  )

  const [isSubmitting, setIsSubmitting] = useState(false)

  // Handlers
  const handleToggleCategory = (category: string) => {
    setSelectedCategories(prev => prev.map(cat =>
      cat.category === category
        ? { ...cat, selected: !cat.selected }
        : cat,
    ))
  }

  const handleSaveCategories = async () => {
    const categoriesToAdd = selectedCategories
      .filter(cat => cat.selected)
      .map(cat => cat.category)

    if (!categoriesToAdd.length)
      return

    try {
      setIsSubmitting(true)
      const res = await addCategories({
        body: { categories: categoriesToAdd },
      })

      if (!res.success)
        throw new Error('Failed to save categories')

      await addLogCategories({
        body: { categories: categoriesToAdd },
        params: { id: logId },
      })

      // Remove saved categories from the list
      setSelectedCategories(prev =>
        prev.filter(c => !res.categories.some(cat => cat.name === c.category)),
      )
    }
    catch (error) {
      logger.error('Failed to save categories:', error)
    }
    finally {
      setIsSubmitting(false)
    }
  }

  return (
    <SpookyModal
      open={open}
      onClose={onClose}
      title="New Mystical Categories"
    >
      <div className="space-y-4">
        <p className="text-purple-200/80">
          Select the categories you'd like to add to your mystical collection:
        </p>

        <ul className="space-y-2">
          {selectedCategories.map(({ category, selected }) => (
            <li key={category} className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleToggleCategory(category)}
                className="flex items-center justify-between w-full p-2 rounded-lg
                 bg-purple-800/30 hover:bg-purple-800/50 transition-colors"
              >
                <span className="text-white text-lg font-medium">{category}</span>
                {selected
                  ? <IconCheck className="h-5 w-5 text-green-400" />
                  : <IconX className="h-5 w-5 text-purple-400/50" />}
              </button>
            </li>
          ))}
        </ul>

        <div className="flex justify-end gap-2 pt-4">
          <SpookyButton
            variant="secondary"
            onClick={onClose}
          >
            Cancel
          </SpookyButton>
          <SpookyButton
            onClick={handleSaveCategories}
            disabled={isSubmitting}
            isLoading={isSubmitting}
          >
            Save
          </SpookyButton>
        </div>
      </div>
    </SpookyModal>
  )
}
