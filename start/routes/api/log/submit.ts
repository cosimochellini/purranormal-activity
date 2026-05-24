import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { ARRAY_LIMITS, CHARACTER_LIMITS, VALIDATION_MESSAGES } from '@/constants'
import { SECRET } from '@/env/secret'
import { imagePipeline } from '@/services/imagePipeline'
import { defineHandlers, method } from '@/services/route/defineHandlers'
import { storyForge } from '@/services/storyForge'
import type { LogSubmitResponse } from '@/types/api/log-submit'
import { ok } from '@/utils/http'
import { logger } from '@/utils/logger'
import { createFriendly, type FriendlyMessages, isAiResultError } from './_friendly'

const answerSchema = z.object({
  question: z.string(),
  answer: z.string(),
})

const submitFormSchema = z.object({
  description: z
    .string()
    .min(ARRAY_LIMITS.MIN_REQUIRED, VALIDATION_MESSAGES.DESCRIPTION_REQUIRED)
    .max(CHARACTER_LIMITS.DESCRIPTION, VALIDATION_MESSAGES.DESCRIPTION_TOO_LONG),
  answers: z
    .array(answerSchema)
    .max(ARRAY_LIMITS.MAX_ANSWERS, VALIDATION_MESSAGES.ANSWERS_TOO_MANY),
  secret: z
    .string()
    .min(1, VALIDATION_MESSAGES.SECRET_REQUIRED)
    .refine((val) => val.toLowerCase() === SECRET, { message: VALIDATION_MESSAGES.SECRET_INVALID }),
})

const messages: FriendlyMessages = {
  AI_UNAVAILABLE:
    'Our mystical AI assistant is temporarily unavailable. Please try again in a moment.',
  AI_UNEXPECTED_RESPONSE:
    'Our mystical AI assistant returned an unexpected response. Please try again.',
  CONNECTION_ISSUE: 'Connection issue detected. Please check your internet and try again.',
  REQUEST_TIMEOUT: 'The request took too long. Please try with a shorter description.',
  GENERIC_FALLBACK: 'Unable to process your paranormal event. Please try again.',
  DB_UNAVAILABLE: 'Unable to save the event at this time. Please try again shortly.',
}

const buildErrorResponse = (text: string) =>
  ok<LogSubmitResponse>({ success: false, errors: { general: [text] } })

const reporter = createFriendly<Response>({
  messages,
  build: buildErrorResponse,
  onError: (error) =>
    isAiResultError(error)
      ? logger.error('storyForge.logDetails returned !ok', error)
      : logger.error('Failed to submit log:', error),
})

export const Route = createFileRoute('/api/log/submit')({
  server: {
    handlers: defineHandlers(
      {
        POST: method<
          {
            description: string
            answers: { question: string; answer: string }[]
            secret: string
          },
          undefined,
          undefined,
          LogSubmitResponse
        >({
          body: submitFormSchema,
          reporter,
          handler: async ({ body }) => {
            const details = await storyForge.logDetails(body.description, body.answers)
            // `AIResult.err` is passed through bare — the envelope routes it
            // via the reporter's `fromAi`. `AIResult.ok` we inspect locally.
            if (!details.ok) return details

            const { title, description, categories, imageDescription } = details.value

            // Inline guard: every realistic failure of `storyForge.categories()`
            // is a DB-port failure (cache miss → libsql query). Keep the
            // categorical `DB_UNAVAILABLE` guarantee that the pre-refactor code
            // had — the reporter's thrown-error matchers would drop the
            // explicit copy for non-Error rejections whose stringification
            // lacks DB tokens.
            let allCategoryIds: number[]
            try {
              allCategoryIds = (await storyForge.categories()).map((c) => c.id)
            } catch (error) {
              logger.error('storyForge.categories() failed during submit:', error)
              return {
                data: {
                  success: false,
                  errors: { general: [messages.DB_UNAVAILABLE ?? messages.GENERIC_FALLBACK] },
                },
              }
            }

            const categoryIds = categories
              .map(({ id }) => id)
              .filter((id) => allCategoryIds.includes(id))

            // The pipeline now logs every outcome internally — no
            // post-call `logPipelineOutcome` invocation needed here.
            const { id } = await imagePipeline.submit({
              draft: { title, description, imageDescription },
              categoryIds,
            })

            return {
              data: { success: true, id, missingCategories: [] },
              invalidate: ['logs', `log:${id}`],
            }
          },
        }),
      },
      { route: '/api/log/submit' },
    ),
  },
})
