import { createFileRoute } from '@tanstack/react-router'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { ARRAY_LIMITS, CHARACTER_LIMITS, VALIDATION_MESSAGES } from '@/constants'
import { LogStatus } from '@/data/enum/logStatus'
import { log, logCategory } from '@/db/schema'
import { db } from '@/drizzle'
import { SECRET } from '@/env/secret'
import { regenerateContents } from '@/services/content'
import type { LogIdDeleteResponse, LogIdGetResponse, LogIdPutResponse } from '@/types/api/log-id'
import { deleteFromR2 } from '@/utils/cloudflare'
import { ok } from '@/utils/http'
import { logger } from '@/utils/logger'

const schema = z.object({
  title: z
    .string()
    .min(ARRAY_LIMITS.MIN_REQUIRED, VALIDATION_MESSAGES.TITLE_REQUIRED)
    .max(CHARACTER_LIMITS.TITLE, VALIDATION_MESSAGES.TITLE_TOO_LONG),
  description: z
    .string()
    .min(ARRAY_LIMITS.MIN_REQUIRED, VALIDATION_MESSAGES.DESCRIPTION_REQUIRED)
    .max(CHARACTER_LIMITS.DESCRIPTION + 100, VALIDATION_MESSAGES.DESCRIPTION_TOO_LONG),
  categories: z
    .array(z.number())
    .min(ARRAY_LIMITS.MIN_REQUIRED, VALIDATION_MESSAGES.CATEGORIES_REQUIRED),
  imageDescription: z.string().nullable(),
  secret: z.string().refine((val) => val === SECRET, { message: 'Invalid secret' }),
})

const deleteSchema = z.object({
  secret: z.string().refine((val) => val === SECRET, { message: 'Invalid secret' }),
})

const getLog = async (id: number) => (await db.select().from(log).where(eq(log.id, id)))[0]

export const Route = createFileRoute('/api/log/$id')({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const url = new URL(request.url)
        const rawId = params.id ?? url.searchParams.get('id')
        const id = Number(rawId)

        try {
          const entry = await getLog(id)

          if (!entry) {
            return ok<LogIdGetResponse>({
              success: false,
            })
          }

          return ok<LogIdGetResponse>({ success: true, data: entry })
        } catch (error) {
          logger.error('Failed to fetch log entry:', error)

          return ok<LogIdGetResponse>({
            success: false,
          })
        }
      },
      PUT: async ({ request, params }) => {
        try {
          const url = new URL(request.url)
          const rawId = params.id ?? url.searchParams.get('id')
          const id = Number(rawId)
          const data = await request.json()
          const result = await schema.safeParseAsync(data)

          if (!result.success) {
            return ok<LogIdPutResponse>({
              success: false,
              errors: result.error.flatten().fieldErrors,
            })
          }

          const currentLog = await getLog(id)
          if (!currentLog) {
            return ok<LogIdPutResponse>({
              success: false,
              errors: { title: ['Log not found'] },
            })
          }

          const { title, description, categories, imageDescription } = result.data

          const [updated] = await db
            .update(log)
            .set({
              ...currentLog,
              title,
              description,
              imageDescription,
              updatedAt: Date.now(),
              status:
                imageDescription !== currentLog.imageDescription
                  ? LogStatus.Created
                  : LogStatus.ImageGenerated,
            })
            .where(eq(log.id, id))
            .returning()

          await db.delete(logCategory).where(eq(logCategory.logId, id))

          if (categories.length > 0) {
            await db
              .insert(logCategory)
              .values(categories.map((category) => ({ logId: id, categoryId: category })))
          }

          await regenerateContents()

          return ok<LogIdPutResponse>({ success: true, data: updated })
        } catch (error) {
          logger.error('Failed to update log:', error)

          return ok<LogIdPutResponse>({
            success: false,
            errors: {
              title: ['Failed to update log'],
            },
          })
        }
      },
      DELETE: async ({ request, params }) => {
        try {
          const data = await request.json()
          const parsed = deleteSchema.safeParse(data)

          if (!parsed.success) {
            return ok<LogIdDeleteResponse>({
              success: false,
              error: 'Invalid secret',
            })
          }

          const url = new URL(request.url)
          const rawId = params.id ?? url.searchParams.get('id')
          const id = Number(rawId)

          await db.delete(log).where(eq(log.id, id))
          await deleteFromR2(id)
          await regenerateContents()

          return ok<LogIdDeleteResponse>({ success: true })
        } catch (error) {
          logger.error('Failed to delete log:', error)

          return ok<LogIdDeleteResponse>({
            success: false,
            error: 'Failed to delete log',
          })
        }
      },
    },
  },
})
