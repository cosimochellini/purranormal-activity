'use client'

import type { PutResponse } from '@/app/api/log/[id]/route'
import type { Log } from '@/db/schema'
import type { FormEvent } from 'react'
import { fetcher } from '@/utils/fetch'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { usePartialState } from '../../hooks/state'
import { transitions } from '../../utils/viewTransition'
import { SpookyButton } from '../common/SpookyButton'
import { EventImage } from '../events/EventImage'
import { CategorySelector } from './CategorySelector'

interface EditLogFormProps {
  initialData: Log
}

const updateLog = fetcher<PutResponse, never, Partial<Log>>('/api/log/[id]', 'PUT')
const deleteLog = fetcher('/api/log/[id]', 'DELETE')

export function EditLogForm({ initialData }: EditLogFormProps) {
  const router = useRouter()
  const [submitting, setSubmitting] = usePartialState({ form: false, delete: false })
  const [error, setError] = useState('')
  const [formData, setFormData] = useState(initialData)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setSubmitting({ form: true })
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
      setSubmitting({ delete: false, form: false })
    }
  }

  const handleDelete = async () => {
    setSubmitting({ delete: true })
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
      setSubmitting({ delete: false, form: false })
    }
  }

  const styles = transitions(initialData.id)

  return (
    <>
      <EventImage
        log={initialData}
        className="mb-8"
        width={200}
        height={200}
        style={styles.image}
      />

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
            style={styles.title}
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
            style={styles.description}
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
          styles={styles.categories}
          onChange={categories => setFormData(prev => ({ ...prev, categories: JSON.stringify(categories) }))}
        />

        <div className="flex justify-end gap-4">
          <SpookyButton
            type="button"
            onClick={handleDelete}
            variant="danger"
            disabled={submitting.delete}
            isLoading={submitting.delete}
          >
            Delete
          </SpookyButton>
          <SpookyButton
            type="submit"
            disabled={submitting.form}
            isLoading={submitting.form}
          >
            Save Changes
          </SpookyButton>
        </div>
      </form>
    </>
  )
}
