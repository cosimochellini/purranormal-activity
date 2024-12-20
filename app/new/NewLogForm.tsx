'use client'

import { categories } from '@/data/enum/category'

import { useState, useTransition } from 'react'
import { typedObjectKeys } from '../../utils/typed'
import { createLog } from '../actions/log'
import { SpookyButton } from '../components/common/SpookyButton'

export function NewLogForm() {
  const [isPending, startTransition] = useTransition()
  const [errorMessage, setErrorMessage] = useState('')
  const [completed, setCompleted] = useState(false)

  const handleSubmit = async (formData: FormData) => {
    startTransition(async () => {
      const response = await createLog(formData)

      if (!response.success)
        return setErrorMessage(typedObjectKeys(response.errors ?? {}).find(key => response.errors?.[key]?.length) ?? '')

      setCompleted(true)
    })
  }

  if (completed)
    return <div className="rounded-md p-4 bg-green-900/30">Log created successfully</div>

  return (
    <form
      action={handleSubmit}
      className="space-y-6 rounded-lg bg-purple-900/30 p-6 backdrop-blur-sm"
    >

      {errorMessage && (
        <div className="rounded-md p-4 bg-red-900/30">
          {errorMessage}
        </div>
      )}

      <div className="space-y-2">
        <label htmlFor="title" className="block text-sm font-medium text-purple-200">
          Event Title
        </label>
        <input
          type="text"
          id="title"
          name="title"
          required
          className="w-full rounded-md border border-purple-700/30 bg-purple-900/30 px-4 py-2 text-white placeholder-purple-300/50 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
          placeholder="What supernatural event occurred?"
        />

      </div>

      <div className="space-y-2">
        <label htmlFor="category" className="block text-sm font-medium text-purple-200">
          Category
        </label>
        <select
          id="category"
          name="category"
          required
          className="w-full rounded-md border border-purple-700/30 bg-purple-900/30 px-4 py-2 text-white focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
        >
          <option value="">Select a category</option>
          {typedObjectKeys(categories).map(category => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <label htmlFor="description" className="block text-sm font-medium text-purple-200">
          Description
        </label>
        <textarea
          id="description"
          name="description"
          required
          rows={4}
          className="w-full rounded-md border border-purple-700/30 bg-purple-900/30 px-4 py-2 text-white placeholder-purple-300/50 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
          placeholder="Describe the paranormal occurrence..."
        />
      </div>

      <SpookyButton
        type="submit"
        fullWidth
        isLoading={isPending}
      >
        Record Supernatural Event
      </SpookyButton>
    </form>
  )
}
