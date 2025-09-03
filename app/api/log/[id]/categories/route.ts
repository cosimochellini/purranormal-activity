import { z } from 'zod'
import { ARRAY_LIMITS, VALIDATION_MESSAGES } from '@/constants'
import { logCategory } from '@/db/schema'
import { db } from '@/drizzle'
import { ok } from '@/utils/http'
import { logger } from '@/utils/logger'

export const runtime = 'edge'

const schema = z.object({
  categories: z
    .array(z.number())
    .min(ARRAY_LIMITS.MIN_REQUIRED, VALIDATION_MESSAGES.CATEGORY_REQUIRED),
})

export type Response =
  | {
      success: true
    }
  | {
      success: false
      errors: Partial<Record<keyof typeof schema.shape, string[]>>
    }

export async function POST(request: Request) {
  try {
    const url = new URL(request.url)
    const logId = Number(url.searchParams.get('id'))
    const data = await request.json()
    const result = await schema.safeParseAsync(data)

    if (!result.success) {
      return ok<Response>({
        success: false,
        errors: result.error.flatten().fieldErrors,
      })
    }

    const { categories } = result.data

    await db.insert(logCategory).values(
      categories.map((categoryId) => ({
        logId,
        categoryId,
      })),
    )

    return ok<Response>({ success: true })
  } catch (error) {
    logger.error('Failed to add categories to log:', error)

    return ok<Response>({
      success: false,
      errors: {
        categories: ['Failed to add categories to log'],
      },
    })
  }
}

export type Body = z.infer<typeof schema>
