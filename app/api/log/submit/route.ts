import { z } from 'zod'
import { LogStatus } from '@/data/enum/logStatus'
import { category, log, logCategory } from '@/db/schema'
import { db } from '@/drizzle'
import { SECRET } from '@/env/secret'
import { generateLogDetails } from '@/services/ai'
import { ok } from '@/utils/http'
import { logger } from '@/utils/logger'
import { regenerateContents } from '@/utils/next'

const submitFormSchema = z.object({
  description: z.string().min(1, 'Description is required').max(500, 'Description is too long'),
  answers: z
    .array(
      z.object({
        question: z.string(),
        answer: z.string(),
      }),
    )
    .max(5, 'At least 5 follow-up answers are required'),
  secret: z.string().refine((val) => val === SECRET, { message: 'Invalid secret' }),
})

export const runtime = 'edge'

export async function POST(request: Request) {
  try {
    const data = await request.json()
    const result = await submitFormSchema.safeParseAsync(data)

    if (!result.success) {
      return ok<Response>({
        success: false,
        errors: result.error.flatten().fieldErrors,
      })
    }

    const { title, description, categories, imageDescription, missingCategories } =
      await generateLogDetails(result.data.description, result.data.answers)

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

    return ok<Response>({ success: true, id: newLog.id, missingCategories })
  } catch (error) {
    logger.error('Failed to submit log:', error)

    return ok<Response>({
      success: false,
      errors: {
        description: [JSON.stringify(error)],
      },
    })
  }
}

export type Response =
  | {
      success: true
      id: number
      missingCategories: string[]
    }
  | {
      success: false
      errors: Partial<Record<keyof typeof submitFormSchema.shape, string[]>>
    }

export type Body = z.infer<typeof submitFormSchema>
