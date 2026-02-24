import cn from 'classnames'
import { useState } from 'react'
import { z } from 'zod'
import { ARRAY_LIMITS, CHARACTER_LIMITS, UI_CONFIG, VALIDATION_MESSAGES } from '@/constants'
import type { LogRefineBody, LogRefineResponse } from '@/types/api/log-refine'
import { fetcher } from '../../utils/fetch'
import { logger } from '../../utils/logger'
import { Loading } from '../common/Loading'
import { SpookyButton } from '../common/SpookyButton'
import { SpookyCard } from '../common/SpookyCard'
import { SpookyModal } from '../common/SpookyModal'
import { SpookyTextarea } from '../common/SpookyTextarea'
import type { StateSectionProps } from '.'

const refineLog = fetcher<LogRefineResponse, never, LogRefineBody>('/api/log/refine', 'POST')

const MIN_DESCRIPTION_LENGTH = ARRAY_LIMITS.MIN_REQUIRED

// Zod schema for client-side validation (matches backend validation)
const descriptionSchema = z.object({
  description: z
    .string()
    .min(MIN_DESCRIPTION_LENGTH, VALIDATION_MESSAGES.DESCRIPTION_REQUIRED)
    .max(
      CHARACTER_LIMITS.REFINEMENT_DESCRIPTION,
      VALIDATION_MESSAGES.DESCRIPTION_REFINEMENT_TOO_LONG,
    )
    .refine((val) => val.trim().length >= MIN_DESCRIPTION_LENGTH, {
      message: VALIDATION_MESSAGES.DESCRIPTION_TOO_SHORT,
    }),
})

export function InitialSection({ onNext, description: initialDescription }: StateSectionProps) {
  const [description, setDescription] = useState(initialDescription ?? '')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [inlineError, setInlineError] = useState<string | null>(null)
  const [showErrorModal, setShowErrorModal] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const remainingChars = CHARACTER_LIMITS.REFINEMENT_DESCRIPTION - description.length

  const handleSubmit = async () => {
    // Clear previous errors
    setErrorMessage(null)
    setInlineError(null)
    setShowErrorModal(false)

    // Client-side validation with Zod
    const validationResult = descriptionSchema.safeParse({ description })

    if (!validationResult.success) {
      const firstError = validationResult.error.issues[0]?.message
      if (firstError) {
        setInlineError(firstError)
        setErrorMessage(firstError)
      }
      return
    }

    try {
      setIsSubmitting(true)
      const response = await refineLog({ body: { description: validationResult.data.description } })

      if (!response.success) {
        const errorMsg =
          response.errors.description?.at(0) ?? 'Unable to process your event description'
        setErrorMessage(errorMsg)
        setInlineError(errorMsg)
        setShowErrorModal(true)
        logger.error('Validation errors:', response.errors)
        return
      }

      const questions = response.content
      onNext?.({ description: validationResult.data.description, questions })
    } catch (error) {
      logger.error('Failed to refine log:', error)
      setErrorMessage(
        'Unable to connect to the server. Please check your connection and try again.',
      )
      setShowErrorModal(true)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDescriptionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setDescription(e.target.value)
    // Clear errors when user types
    if (inlineError || errorMessage) {
      setInlineError(null)
      setErrorMessage(null)
    }
  }

  if (isSubmitting) return <Loading />

  return (
    <>
      <SpookyCard>
        <div className="space-y-4">
          <div>
            <SpookyTextarea
              id="description"
              label="Description"
              required
              rows={UI_CONFIG.TEXTAREA_ROWS_SMALL}
              value={description}
              onChange={handleDescriptionChange}
              placeholder="Describe the paranormal occurrence..."
              className={cn('min-h-56', {
                'border-red-500/50': !!inlineError,
              })}
            />

            {/* Validation errors and character counter */}
            <div className="mt-2 space-y-1">
              {inlineError && (
                <div className="animate-fadeIn flex items-start gap-2 text-sm text-red-400">
                  <span className="text-red-400">⚠</span>
                  <span>{inlineError}</span>
                </div>
              )}

              <div className="flex justify-end text-xs">
                <span
                  className={cn('transition-colors duration-300', {
                    'text-orange-400': remainingChars < 500,
                    'text-purple-300/70': remainingChars >= 500,
                  })}
                >
                  {remainingChars} characters remaining
                </span>
              </div>
            </div>
          </div>

          <SpookyButton type="button" fullWidth onClick={handleSubmit} disabled={isSubmitting}>
            Record Supernatural Event
          </SpookyButton>
        </div>
      </SpookyCard>

      {/* Error Modal */}
      <SpookyModal
        title="Something Went Wrong"
        open={showErrorModal}
        onClose={() => setShowErrorModal(false)}
      >
        <div className="space-y-4">
          <p className="text-purple-200/90 leading-relaxed">{errorMessage}</p>
          <div className="flex gap-3 justify-end mt-6">
            <SpookyButton
              onClick={() => setShowErrorModal(false)}
              variant="secondary"
              className="flex-1 sm:flex-none"
            >
              Dismiss
            </SpookyButton>
            <SpookyButton onClick={handleSubmit} className="flex-1 sm:flex-none">
              Try Again
            </SpookyButton>
          </div>
        </div>
      </SpookyModal>
    </>
  )
}
