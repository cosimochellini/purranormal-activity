import { z } from 'zod'
import { ARRAY_LIMITS, CHARACTER_LIMITS, VALIDATION_MESSAGES } from '@/constants'
import { LogStatus } from '@/data/enum/logStatus'
import { category, log, logCategory } from '@/db/schema'
import { db } from '@/drizzle'
import { SECRET } from '@/env/secret'
import { generateLogDetails } from '@/services/ai'
import { regenerateContents } from '@/services/content'
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

export const runtime = 'edge'

export async function POST(request: Request) {
  try {
    const data = await request.json()
    const result = await submitFormSchema.safeParseAsync(data)

    if (!result.success) {
      return ok<LogSubmitResponse>({
        success: false,
        errors: Object.fromEntries(
          Object.entries(z.treeifyError(result.error).properties || {}).map(([key, value]) => [
            key,
            value?.errors || [],
          ]),
        ),
      })
    }

    const { title, description, categories, imageDescription } = await generateLogDetails(
      result.data.description,
      result.data.answers,
    )

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

    await regenerateContents()

    return ok<LogSubmitResponse>({ success: true, id: newLog.id, missingCategories: [] })
  } catch (error) {
    logger.error('Failed to submit log:', error)

    // Determine user-friendly error message based on error type
    let errorMessage = 'Unable to process your paranormal event. Please try again.'

    if (error instanceof Error) {
      // Check for specific error types
      if (error.message.includes('AI') || error.message.includes('OpenAI')) {
        errorMessage =
          'Our mystical AI assistant is temporarily unavailable. Please try again in a moment.'
      } else if (error.message.includes('database') || error.message.includes('DB')) {
        errorMessage = 'Unable to save the event at this time. Please try again shortly.'
      } else if (error.message.includes('network') || error.message.includes('fetch')) {
        errorMessage = 'Connection issue detected. Please check your internet and try again.'
      }
    }

    return ok<LogSubmitResponse>({
      success: false,
      errors: {
        general: [errorMessage],
      },
    })
  }
}
