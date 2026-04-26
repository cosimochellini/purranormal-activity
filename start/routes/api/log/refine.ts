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

const AI_UNAVAILABLE =
  'Our mystical AI assistant is temporarily unavailable. Please try again in a moment.'
const CONNECTION_ISSUE = 'Connection issue detected. Please check your internet and try again.'
const REQUEST_TIMEOUT = 'The request took too long. Please try with a shorter description.'
const AI_UNEXPECTED_RESPONSE =
  'Our mystical AI assistant returned an unexpected response. Please try again.'
const GENERIC_REFINE_FALLBACK = 'Unable to generate questions for your event. Please try again.'

const matchInfraMessage = (message: string) => {
  if (message.includes('timeout')) return REQUEST_TIMEOUT
  if (message.includes('network') || message.includes('fetch')) return CONNECTION_ISSUE
  return null
}

const friendlyAiErrorText = (kind: AIError, message: string) => {
  if (kind === 'parse' || kind === 'validation') return AI_UNEXPECTED_RESPONSE
  // kind === 'model' — could be rate-limit, network, timeout, etc. Inspect
  // the underlying message so the user sees the most accurate copy possible.
  return matchInfraMessage(message) ?? AI_UNAVAILABLE
}

const friendlyCatchText = (message: string) => {
  if (message.includes('AI') || message.includes('OpenAI')) return AI_UNAVAILABLE
  return matchInfraMessage(message) ?? GENERIC_REFINE_FALLBACK
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
              errors: { description: [friendlyAiErrorText(r.error, r.message)] },
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
