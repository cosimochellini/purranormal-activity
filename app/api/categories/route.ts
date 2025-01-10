import type { Category } from '@/db/schema'
import { category } from '@/db/schema'
import { db } from '@/drizzle'
import { ok } from '@/utils/http'
import { logger } from '@/utils/logger'
import { z } from 'zod'

export type GetResponse = Category[]
export async function GET() {
  const categories = await db.select().from(category)

  return ok<GetResponse>(categories)
}

const schema = z.object({
  categories: z.array(z.string()).min(1, 'At least one category is required'),
})

export type PostResponse = {
  success: true
  categories: { id: number, name: string }[]
} | {
  success: false
  errors: Partial<Record<keyof typeof schema.shape, string[]>>
}

export async function POST(request: Request) {
  try {
    const data = await request.json()
    const result = await schema.safeParseAsync(data)

    if (!result.success) {
      return ok<PostResponse>({
        success: false,
        errors: result.error.flatten().fieldErrors,
      })
    }

    const { categories: newCategories } = result.data

    const categories = await db.insert(category).values(
      newCategories.map(name => ({
        name,
        icon: 'QuestionMark', // Default icon for new categories
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })),
    ).returning({
      id: category.id,
      name: category.name,
    })

    return ok<PostResponse>({ success: true, categories })
  }
  catch (error) {
    logger.error('Failed to create categories:', error)

    return ok<PostResponse>({
      success: false,
      errors: {
        categories: ['Failed to create categories'],
      },
    })
  }
}

export type Body = z.infer<typeof schema>
