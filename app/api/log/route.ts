import { z } from 'zod'
import { ARRAY_LIMITS, CHARACTER_LIMITS, VALIDATION_MESSAGES } from '@/constants'
import { LogStatus } from '@/data/enum/logStatus'
import { log, logCategory } from '@/db/schema'
import { db } from '@/drizzle'
import type { LogPostResponse } from '@/types/api/log'
import { ok } from '@/utils/http'
import { logger } from '@/utils/logger'

const logFormSchema = z.object({
  title: z
    .string()
    .min(ARRAY_LIMITS.MIN_REQUIRED, VALIDATION_MESSAGES.TITLE_REQUIRED)
    .max(CHARACTER_LIMITS.TITLE, VALIDATION_MESSAGES.TITLE_TOO_LONG),
  description: z
    .string()
    .min(ARRAY_LIMITS.MIN_REQUIRED, VALIDATION_MESSAGES.DESCRIPTION_REQUIRED)
    .max(CHARACTER_LIMITS.DESCRIPTION, VALIDATION_MESSAGES.DESCRIPTION_TOO_LONG),
  categories: z
    .array(z.number())
    .min(ARRAY_LIMITS.MIN_REQUIRED, VALIDATION_MESSAGES.CATEGORIES_REQUIRED),
})

export const runtime = 'edge'
export async function POST(request: Request) {
  const data = await request.json()

  const result = await logFormSchema.safeParseAsync(data)

  if (!result.success) {
    return ok<LogPostResponse>({
      success: false,
      errors: result.error.flatten().fieldErrors,
    })
  }

  try {
    const [created] = await db
      .insert(log)
      .values({
        ...result.data,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        status: LogStatus.Created,
      })
      .returning()

    if (result.data.categories.length > 0) {
      await db
        .insert(logCategory)
        .values(
          result.data.categories.map((category) => ({ logId: created.id, categoryId: category })),
        )
    }

    return ok<LogPostResponse>({ success: true })
  } catch (error) {
    logger.error('Failed to create log:', error)

    return ok<LogPostResponse>({ success: false, errors: {} })
  }
}
