import { useState } from 'react'
import type { Body, Response } from '@/app/api/log/refine/route'
import { fetcher } from '../../utils/fetch'
import { Loading } from '../common/Loading'
import { SpookyButton } from '../common/SpookyButton'
import { SpookyCard } from '../common/SpookyCard'
import { SpookyTextarea } from '../common/SpookyTextarea'
import type { FormValues } from '.'

interface InitialSectionProps {
  onInitialSuccess?: (body: Partial<FormValues>) => void
}

const refineLog = fetcher<Response, never, Body>('/api/log/refine', 'POST')

export function InitialSection({ onInitialSuccess }: InitialSectionProps) {
  const [description, setDescription] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async () => {
    try {
      setIsSubmitting(true)
      const response = await refineLog({ body: { description } })

      if (!response.success)
        return setErrorMessage(response.errors.description?.at(0) ?? 'Failed to refine log')

      const questions = response.content

      onInitialSuccess?.({ description, questions })
    } catch (error) {
      if (error instanceof Error) setErrorMessage(error.message)
      else setErrorMessage(JSON.stringify(error))
    }
  }

  if (isSubmitting) return <Loading />

  return (
    <SpookyCard>
      {errorMessage && (
        <div className="rounded-md p-4 bg-red-900/30 text-red-200">{errorMessage}</div>
      )}

      <SpookyTextarea
        id="description"
        label="Description"
        required
        rows={4}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Describe the paranormal occurrence..."
        className="min-h-56"
      />

      <SpookyButton type="button" fullWidth onClick={handleSubmit}>
        Record Supernatural Event
      </SpookyButton>
    </SpookyCard>
  )
}
