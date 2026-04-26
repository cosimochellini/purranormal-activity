import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { ARRAY_LIMITS, CHARACTER_LIMITS, VALIDATION_MESSAGES } from '@/constants'
import { type AIError, storyForge } from '@/services/storyForge'
import type { LogRefineResponse } from '@/types/api/log-refine'
import { ok } from '@/utils/http'
import { logger } from '@/utils/logger'

const schema = z.object({
  description: z
    .string()
    .min(ARRAY_LIMITS.MIN_REQUIRED, VALIDATION_MESSAGES.DESCRIPTION_REQUIRED)
    .max(CHARACTER_LIMITS.REFINEMENT_DESCRIPTION, VALIDATION_MESSAGES.DESCRIPTION_TOO_LONG),
})

const friendlyAiErrorText = (_kind: AIError) =>
  'Our mystical AI assistant is temporarily unavailable. Please try again in a moment.'

const friendlyCatchText = (message: string) => {
  if (message.includes('AI') || message.includes('OpenAI')) {
    return 'Our mystical AI assistant is temporarily unavailable. Please try again in a moment.'
  }
  if (message.includes('network') || message.includes('fetch')) {
    return 'Connection issue detected. Please check your internet and try again.'
  }
  if (message.includes('timeout')) {
    return 'The request took too long. Please try with a shorter description.'
  }
  return 'Unable to generate questions for your event. Please try again.'
}

export const Route = createFileRoute('/api/log/refine')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const data = await request.json()
          const result = await schema.safeParseAsync(data)

          if (!result.success) {
            const errors = result.error.flatten().fieldErrors
            return ok<LogRefineResponse>({ success: false, errors })
          }

          const { description } = result.data
          const r = await storyForge.questions(description)
          if (!r.ok) {
            logger.error('storyForge.questions returned !ok', r)
            return ok<LogRefineResponse>({
              success: false,
              errors: { description: [friendlyAiErrorText(r.error)] },
            })
          }
          return ok<LogRefineResponse>({ success: true, content: r.value })
        } catch (error) {
          logger.error('Failed to generate follow-up questions:', error)

          const message = error instanceof Error ? error.message : ''
          return ok<LogRefineResponse>({
            success: false,
            errors: {
              description: [friendlyCatchText(message)],
            },
          })
        }
      },
    },
  },
})
