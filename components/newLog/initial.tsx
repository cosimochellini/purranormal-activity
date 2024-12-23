import type { Body, FollowUpQuestion, Response } from '@/app/api/log/refine/route'
import { fetcher } from '@/utils/fetch'
import { typedObjectKeys } from '@/utils/typed'
import { useState, useTransition } from 'react'
import { SpookyButton } from '../common/SpookyButton'

const refineLog = fetcher<Response, never, Body>('/api/log/refine', 'POST')

interface InitialSectionProps {
  onInitialSuccess?: (body: { description: string, questions: FollowUpQuestion[] }) => void
}

export function InitialSection({ onInitialSuccess }: InitialSectionProps) {
  const [description, setDescription] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [isPending, startTransition] = useTransition()

  const handleSubmit = () => {
    startTransition(async () => {
      const response = await refineLog({ body: { description } })

      if (!response.success)
        return setErrorMessage(typedObjectKeys(response.errors ?? {}).find(key => response.errors?.[key]?.length) ?? '')

      onInitialSuccess?.({ description, questions: response.content })
    })
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-6 rounded-lg bg-purple-900/30 p-6 backdrop-blur-sm"
    >

      {errorMessage && (
        <div className="rounded-md p-4 bg-red-900/30">
          {errorMessage}
        </div>
      )}

      <div className="space-y-2">
        <label htmlFor="description" className="block text-sm font-medium text-purple-200">
          Description
        </label>
        <textarea
          id="description"
          name="description"
          required
          rows={4}
          value={description}
          onChange={e => setDescription(e.target.value)}
          className="w-full rounded-md border border-purple-700/30 bg-purple-900/30 px-4 py-2 text-white placeholder-purple-300/50 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
          placeholder="Describe the paranormal occurrence..."
        />
      </div>

      <SpookyButton
        type="button"
        fullWidth
        isLoading={isPending}
        onClick={handleSubmit}
      >
        Record Supernatural Event
      </SpookyButton>
    </form>
  )
}
