import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { ARRAY_LIMITS, CHARACTER_LIMITS, VALIDATION_MESSAGES } from '@/constants'
import { SECRET } from '@/env/secret'
import { imagePipeline, logPipelineOutcome } from '@/services/imagePipeline'
import { storyForge } from '@/services/storyForge'
import type { LogSubmitResponse } from '@/types/api/log-submit'
import { ok } from '@/utils/http'
import { logger } from '@/utils/logger'
import { createFriendly, type FriendlyMessages } from './_friendly'

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

const friendly = createFriendly<Response>({
  messages,
  build: (text) => ok<LogSubmitResponse>({ success: false, errors: { general: [text] } }),
  onError: (error) => logger.error('Failed to submit log:', error),
})

export const Route = createFileRoute('/api/log/submit')({
  server: {
    handlers: {
      POST: ({ request }) =>
        friendly.guard(async () => {
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

          const details = friendly.fromAi(
            await storyForge.logDetails(result.data.description, result.data.answers),
          )
          if (!details.ok) return details.response

          const { title, description, categories, imageDescription } = details.value

          const allCategoryIds = (await storyForge.categories()).map((c) => c.id)

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
        }),
    },
  },
})
