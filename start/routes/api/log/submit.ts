import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { ARRAY_LIMITS, CHARACTER_LIMITS, VALIDATION_MESSAGES } from '@/constants'
import { LogStatus } from '@/data/enum/logStatus'
import { category, log, logCategory } from '@/db/schema'
import { db } from '@/drizzle'
import { SECRET } from '@/env/secret'
import { regenerateContents } from '@/services/content'
import { storyForge } from '@/services/storyForge'
import type { LogSubmitResponse } from '@/types/api/log-submit'
import { ok } from '@/utils/http'
import { logger } from '@/utils/logger'

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

const mapAiMessageToFriendlyText = (message: string) => {
  if (message.includes('AI') || message.includes('OpenAI')) {
    return 'Our mystical AI assistant is temporarily unavailable. Please try again in a moment.'
  }
  if (message.includes('database') || message.includes('DB')) {
    return 'Unable to save the event at this time. Please try again shortly.'
  }
  if (message.includes('network') || message.includes('fetch')) {
    return 'Connection issue detected. Please check your internet and try again.'
  }
  return 'Unable to process your paranormal event. Please try again.'
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
              errors: { general: [mapAiMessageToFriendlyText(detailsResult.message)] },
            })
          }

          const { title, description, categories, imageDescription } = detailsResult.value

          const allCategories = (await db.select({ id: category.id }).from(category)).map(
            (category) => category.id,
          )

          const [newLog] = await db
            .insert(log)
            .values({
              title,
              description,
              imageDescription,
              createdAt: Date.now(),
              updatedAt: Date.now(),
              status: LogStatus.Created,
            })
            .returning({ id: log.id })

          const categoriesToInsert = categories
            .map(({ id }) => ({ logId: newLog.id, categoryId: id }))
            .filter(({ categoryId }) => allCategories.includes(categoryId))

          if (categoriesToInsert.length > 0) {
            await db.insert(logCategory).values(categoriesToInsert)
          }

          await regenerateContents({ triggerLogId: newLog.id })

          return ok<LogSubmitResponse>(
            { success: true, id: newLog.id, missingCategories: [] },
            { invalidate: ['logs', `log:${newLog.id}`] },
          )
        } catch (error) {
          logger.error('Failed to submit log:', error)

          const message = error instanceof Error ? error.message : ''
          return ok<LogSubmitResponse>({
            success: false,
            errors: {
              general: [mapAiMessageToFriendlyText(message)],
            },
          })
        }
      },
    },
  },
})
