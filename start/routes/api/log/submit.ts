import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { ARRAY_LIMITS, CHARACTER_LIMITS, VALIDATION_MESSAGES } from '@/constants'
import { SECRET } from '@/env/secret'
import { imagePipeline, logPipelineOutcome } from '@/services/imagePipeline'
import { storyForge } from '@/services/storyForge'
import type { LogSubmitResponse } from '@/types/api/log-submit'
import { ok } from '@/utils/http'
import { logger } from '@/utils/logger'
import { type FriendlyMessages, friendlyAiErrorText, friendlyCatchText } from './_friendly'

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

export const Route = createFileRoute('/api/log/submit')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const data = await request.json()
          const result = await submitFormSchema.safeParseAsync(data)

          if (!result.success) {
            const tree = z.treeifyError(result.error)
            const properties = tree?.properties ?? {}
            return ok<LogSubmitResponse>({
              success: false,
              errors: Object.fromEntries(
                Object.entries(properties).map(([key, value]) => [key, value?.errors ?? []]),
              ),
            })
          }

          const detailsResult = await storyForge.logDetails(
            result.data.description,
            result.data.answers,
          )
          if (!detailsResult.ok) {
            logger.error('storyForge.logDetails returned !ok', detailsResult)
            return ok<LogSubmitResponse>({
              success: false,
              errors: {
                general: [
                  friendlyAiErrorText(detailsResult.error, detailsResult.message, messages),
                ],
              },
            })
          }

          const { title, description, categories, imageDescription } = detailsResult.value

          let allCategoryIds: number[]
          try {
            allCategoryIds = (await storyForge.categories()).map((c) => c.id)
          } catch (error) {
            // This guard is rarely tripped in practice — `logDetails()`
            // already populated the StoryForge cache with the same row
            // set, so the public `categories()` accessor is normally a
            // memoised read with no DB round-trip. The two paths where
            // this catch CAN fire:
            //   (a) `invalidateCategories()` ran between `logDetails()`
            //       and this read (e.g. concurrent `POST /api/categories`
            //       on the same Worker instance) and the re-fetch hit a
            //       transient DB outage.
            //   (b) the cache was empty during `logDetails()` (intentional
            //       per spec — empty results are NOT memoised) and this
            //       second fault read also fails.
            // In both cases we surface DB_UNAVAILABLE rather than insert
            // an under-categorised log row.
            logger.error('storyForge.categories() failed during submit:', error)
            return ok<LogSubmitResponse>({
              success: false,
              errors: {
                general: [messages.DB_UNAVAILABLE ?? messages.GENERIC_FALLBACK],
              },
            })
          }

          const categoryIds = categories
            .map(({ id }) => id)
            .filter((id) => allCategoryIds.includes(id))

          const submitResult = await imagePipeline.submit({
            draft: { title, description, imageDescription },
            categoryIds,
          })
          logPipelineOutcome(submitResult.outcome, 'POST /api/log/submit')

          return ok<LogSubmitResponse>(
            { success: true, id: submitResult.id, missingCategories: [] },
            { invalidate: ['logs', `log:${submitResult.id}`] },
          )
        } catch (error) {
          logger.error('Failed to submit log:', error)

          // Include `error.name` in the matcher input so client-class
          // errors (e.g. `OpenAIError`, `APIConnectionError`,
          // `AbortError`) are correctly attributed even when their
          // message is bland (e.g. just `"fetch failed"`).
          const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error)
          return ok<LogSubmitResponse>({
            success: false,
            errors: {
              general: [friendlyCatchText(message, messages)],
            },
          })
        }
      },
    },
  },
})
