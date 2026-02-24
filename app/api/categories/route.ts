import { z } from 'zod'
import { ARRAY_LIMITS, VALIDATION_MESSAGES } from '@/constants'
import { category } from '@/db/schema'
import { db } from '@/drizzle'
import type { CategoriesGetResponse, CategoriesPostResponse } from '@/types/api/categories'
import { ok } from '@/utils/http'
import { logger } from '@/utils/logger'

export const runtime = 'edge'
export async function GET() {
  try {
    const categories = await db.select().from(category)

    return ok<CategoriesGetResponse>(categories)
  } catch (error) {
    logger.error('Failed to fetch categories:', error)

    return ok<CategoriesGetResponse>([])
  }
}

const schema = z.object({
  categories: z
    .array(z.string())
    .min(ARRAY_LIMITS.MIN_REQUIRED, VALIDATION_MESSAGES.CATEGORY_REQUIRED),
})

export async function POST(request: Request) {
  try {
    const data = await request.json()
    const result = await schema.safeParseAsync(data)

    if (!result.success) {
      return ok<CategoriesPostResponse>({
        success: false,
        errors: result.error.flatten().fieldErrors,
      })
    }

    const { categories: newCategories } = result.data

    const categories = await db
      .insert(category)
      .values(
        newCategories.map((name) => ({
          name,
          icon: 'questionMark', // Default icon for new categories
          createdAt: Date.now(),
          updatedAt: Date.now(),
        })),
      )
      .returning({
        id: category.id,
        name: category.name,
      })

    return ok<CategoriesPostResponse>({ success: true, categories })
  } catch (error) {
    logger.error('Failed to create categories:', error)

    return ok<CategoriesPostResponse>({
      success: false,
      errors: {
        categories: ['Failed to create categories'],
      },
    })
  }
}
