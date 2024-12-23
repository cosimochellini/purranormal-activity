import { useState } from 'react'
import { Loading } from '../common/Loading'
import { SpookyButton } from '../common/SpookyButton'

interface InitialSectionProps {
  onInitialSuccess?: (body: { description: string, stream: ReadableStreamDefaultReader<Uint8Array> }) => unknown
}

export function InitialSection({ onInitialSuccess }: InitialSectionProps) {
  const [description, setDescription] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async () => {
    try {
      setIsSubmitting(true)
      const response = await fetch('/api/log/refine', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ description }),
      })

      if (!response.ok)
        setErrorMessage(response.statusText)

      const stream = response.body?.getReader()
      if (!stream)
        return setErrorMessage('Failed to read response stream')

      onInitialSuccess?.({ description, stream })
    }
    catch (error) {
      if (error instanceof Error)
        setErrorMessage(error.message)
      else
        setErrorMessage(JSON.stringify(error))
    }
  }

  if (isSubmitting)
    return <Loading />

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
        onClick={handleSubmit}
      >
        Record Supernatural Event
      </SpookyButton>
    </form>
  )
}
