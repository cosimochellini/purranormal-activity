import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { ARRAY_LIMITS, CHARACTER_LIMITS, VALIDATION_MESSAGES } from '@/constants'
import { defineHandlers, method } from '@/services/route/defineHandlers'
import { storyForge } from '@/services/storyForge'
import type { LogRefineResponse } from '@/types/api/log-refine'
import { ok } from '@/utils/http'
import { logger } from '@/utils/logger'
import { createFriendly, type FriendlyMessages, isAiResultError } from './_friendly'

const schema = z.object({
  description: z
    .string()
    .min(ARRAY_LIMITS.MIN_REQUIRED, VALIDATION_MESSAGES.DESCRIPTION_REQUIRED)
    .max(CHARACTER_LIMITS.REFINEMENT_DESCRIPTION, VALIDATION_MESSAGES.DESCRIPTION_TOO_LONG),
})

const messages: FriendlyMessages = {
  AI_UNAVAILABLE:
    'Our mystical AI assistant is temporarily unavailable. Please try again in a moment.',
  AI_UNEXPECTED_RESPONSE:
    'Our mystical AI assistant returned an unexpected response. Please try again.',
  CONNECTION_ISSUE: 'Connection issue detected. Please check your internet and try again.',
  REQUEST_TIMEOUT: 'The request took too long. Please try with a shorter description.',
  GENERIC_FALLBACK: 'Unable to generate questions for your event. Please try again.',
}

const reporter = createFriendly<Response>({
  messages,
  build: (text) => ok<LogRefineResponse>({ success: false, errors: { description: [text] } }),
  onError: (error) =>
    isAiResultError(error)
      ? logger.error('storyForge.questions returned !ok', error)
      : logger.error('Failed to generate follow-up questions:', error),
})

export const Route = createFileRoute('/api/log/refine')({
  server: {
    handlers: defineHandlers(
      {
        POST: method({
          body: schema,
          reporter,
          handler: async ({ body }) => {
            const result = await storyForge.questions(body.description)
            if (!result.ok) return result

            const data: LogRefineResponse = { success: true, content: result.value }
            return { data }
          },
        }),
      },
      { route: '/api/log/refine' },
    ),
  },
})
