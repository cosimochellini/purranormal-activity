'use client'

import type { PutResponse } from '@/app/api/log/[id]/route'
import type { Log } from '@/db/schema'
import type { FormEvent } from 'react'
import { fetcher } from '@/utils/fetch'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { SpookyButton } from '../common/SpookyButton'
import { CategorySelector } from './CategorySelector'

interface EditLogFormProps {
  initialData: Log
}

const updateLog = fetcher<PutResponse, never, Partial<Log>>('/api/log/[id]', 'PUT')
const deleteLog = fetcher('/api/log/[id]', 'DELETE')

export function EditLogForm({ initialData }: EditLogFormProps) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [formData, setFormData] = useState(initialData)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError('')

    try {
      const response = await updateLog({
        body: formData,
        params: { id: initialData.id },
      })

      if (!response.success) {
        const errors = Object.values(response.errors).flat()
        setError(errors[0] ?? 'Failed to update')
        return
      }

      router.push(`/${initialData.id}`)
      router.refresh()
    }
    catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update')
    }
    finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async () => {
    setIsSubmitting(true)
    setError('')

    try {
      await deleteLog({
        params: { id: initialData.id },
      })

      router.push('/')
      router.refresh()
    }
    catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete')
    }
    finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-2xl space-y-6 p-4">
      {error && (
        <div className="rounded-md bg-red-900/30 p-4 text-red-200">
          {error}
        </div>
      )}

      <div className="space-y-2">
        <label htmlFor="title" className="block text-sm font-medium text-purple-200">
          Title
        </label>
        <input
          id="title"
          type="text"
          value={formData.title}
          onChange={e => setFormData(prev => ({ ...prev, title: e.target.value }))}
          className="w-full rounded-md border border-purple-700/30 bg-purple-900/30 px-4 py-2 text-white placeholder-purple-300/50 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
        />
      </div>
      <div className="space-y-2">
        <label htmlFor="description" className="block text-sm font-medium text-purple-200">
          Description
        </label>
        <textarea
          id="description"
          value={formData.description}
          onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
          rows={6}
          className="w-full min-h-[150px] rounded-md border border-purple-700/30 bg-purple-900/30 px-4 py-2 text-white placeholder-purple-300/50 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="imageDescription" className="block text-sm font-medium text-purple-200">
          Image Description
        </label>
        <textarea
          id="imageDescription"
          value={formData.imageDescription ?? ''}
          onChange={e => setFormData(prev => ({ ...prev, imageDescription: e.target.value }))}
          rows={6}
          className="w-full min-h-[150px] rounded-md border border-purple-700/30 bg-purple-900/30 px-4 py-2 text-white placeholder-purple-300/50 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
        />
      </div>
      <CategorySelector
        selected={JSON.parse(formData.categories)}
        onChange={categories => setFormData(prev => ({ ...prev, categories: JSON.stringify(categories) }))}
      />

      <div className="flex justify-end gap-4">
        <SpookyButton
          type="button"
          onClick={handleDelete}
          variant="danger"
          disabled={isSubmitting}
          isLoading={isSubmitting}
        >
          Delete
        </SpookyButton>
        <SpookyButton
          type="submit"
          disabled={isSubmitting}
          isLoading={isSubmitting}
        >
          Save Changes
        </SpookyButton>
      </div>
    </form>
  )
}
