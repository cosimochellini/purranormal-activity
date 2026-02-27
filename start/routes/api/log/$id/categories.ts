import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { ARRAY_LIMITS, VALIDATION_MESSAGES } from '@/constants'
import { logCategory } from '@/db/schema'
import { db } from '@/drizzle'
import type { LogIdCategoriesPostResponse } from '@/types/api/log-id-categories'
import { ok } from '@/utils/http'
import { logger } from '@/utils/logger'

const schema = z.object({
  categories: z
    .array(z.number())
    .min(ARRAY_LIMITS.MIN_REQUIRED, VALIDATION_MESSAGES.CATEGORY_REQUIRED),
})

export const Route = createFileRoute('/api/log/$id/categories')({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        try {
          const logId = Number(params.id)

          if (Number.isNaN(logId)) {
            return ok<LogIdCategoriesPostResponse>({
              success: false,
              errors: {
                categories: ['Invalid log id'],
              },
            })
          }

          const data = await request.json()
          const result = await schema.safeParseAsync(data)

          if (!result.success) {
            return ok<LogIdCategoriesPostResponse>({
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

          return ok<LogIdCategoriesPostResponse>({ success: true })
        } catch (error) {
          logger.error('Failed to add categories to log:', error)

          return ok<LogIdCategoriesPostResponse>({
            success: false,
            errors: {
              categories: ['Failed to add categories to log'],
            },
          })
        }
      },
    },
  },
})
