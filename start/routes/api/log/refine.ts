import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { ARRAY_LIMITS, CHARACTER_LIMITS, VALIDATION_MESSAGES } from '@/constants'
import { createQuestions } from '@/services/ai'
import type { LogRefineResponse } from '@/types/api/log-refine'
import { ok } from '@/utils/http'
import { logger } from '@/utils/logger'

const schema = z.object({
  description: z
    .string()
    .min(ARRAY_LIMITS.MIN_REQUIRED, VALIDATION_MESSAGES.DESCRIPTION_REQUIRED)
    .max(CHARACTER_LIMITS.REFINEMENT_DESCRIPTION, VALIDATION_MESSAGES.DESCRIPTION_TOO_LONG),
})

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
          const content = await createQuestions(description)
          return ok<LogRefineResponse>({ success: true, content })
        } catch (error) {
          logger.error('Failed to generate follow-up questions:', error)

          let errorMessage = 'Unable to generate questions for your event. Please try again.'
          if (error instanceof Error) {
            if (error.message.includes('AI') || error.message.includes('OpenAI')) {
              errorMessage =
                'Our mystical AI assistant is temporarily unavailable. Please try again in a moment.'
            } else if (error.message.includes('network') || error.message.includes('fetch')) {
              errorMessage = 'Connection issue detected. Please check your internet and try again.'
            } else if (error.message.includes('timeout')) {
              errorMessage = 'The request took too long. Please try with a shorter description.'
            }
          }

          return ok<LogRefineResponse>({
            success: false,
            errors: {
              description: [errorMessage],
            },
          })
        }
      },
    },
  },
})
