import { createFileRoute } from '@tanstack/react-router'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { ARRAY_LIMITS, CHARACTER_LIMITS, VALIDATION_MESSAGES } from '@/constants'
import { LogStatus } from '@/data/enum/logStatus'
import { log, logCategory } from '@/db/schema'
import { db } from '@/drizzle'
import { SECRET } from '@/env/secret'
import { imagePipeline, logPipelineOutcome } from '@/services/imagePipeline'
import { defineHandlers, method } from '@/services/route/defineHandlers'
import type {
  LogIdDeleteBody,
  LogIdDeleteResponse,
  LogIdGetResponse,
  LogIdPutBody,
  LogIdPutResponse,
} from '@/types/api/log-id'
import { deleteFromR2 } from '@/utils/cloudflare'
import { ok } from '@/utils/http'
import { logger } from '@/utils/logger'
import { createFriendly, type FriendlyMessages } from './_friendly'

const putSchema = z.object({
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

// Routes without an AI dependency still need a reporter (envelope-mandated)
// to funnel thrown errors into the route's failure shape. The friendly text
// is classified by `createFriendly` but the slot/key is route-local.
const sharedMessages: FriendlyMessages = {
  AI_UNAVAILABLE:
    'Our mystical AI assistant is temporarily unavailable. Please try again in a moment.',
  AI_UNEXPECTED_RESPONSE:
    'Our mystical AI assistant returned an unexpected response. Please try again.',
  CONNECTION_ISSUE: 'Connection issue detected. Please check your internet and try again.',
  REQUEST_TIMEOUT: 'The request took too long. Please try again.',
  GENERIC_FALLBACK: 'Failed to update log',
  DB_UNAVAILABLE: 'Failed to update log',
}

const getReporter = createFriendly<Response>({
  messages: sharedMessages,
  // GET's public failure shape is just `{ success: false }` — no message slot.
  build: () => ok<LogIdGetResponse>({ success: false }),
  onError: (error) => logger.error('Failed to fetch log entry:', error),
})

const putReporter = createFriendly<Response>({
  messages: sharedMessages,
  build: (text) => ok<LogIdPutResponse>({ success: false, errors: { title: [text] } }),
  onError: (error) => logger.error('Failed to update log:', error),
})

const deleteReporter = createFriendly<Response>({
  messages: { ...sharedMessages, GENERIC_FALLBACK: 'Failed to delete log' },
  build: (text) => ok<LogIdDeleteResponse>({ success: false, error: text }),
  onError: (error) => logger.error('Failed to delete log:', error),
})

const getLog = async (id: number) => (await db.select().from(log).where(eq(log.id, id)))[0]

export const Route = createFileRoute('/api/log/$id')({
  server: {
    handlers: defineHandlers(
      {
        GET: method<undefined, undefined, undefined, LogIdGetResponse>({
          reporter: getReporter,
          handler: async (_input, { params }) => {
            const id = Number(params.id)
            if (Number.isNaN(id)) {
              return { data: { success: false } as LogIdGetResponse }
            }

            const entry = await getLog(id)
            const data: LogIdGetResponse = entry
              ? { success: true, data: entry }
              : { success: false }
            return { data }
          },
        }),
        PUT: method<LogIdPutBody, undefined, undefined, LogIdPutResponse>({
          body: putSchema,
          reporter: putReporter,
          handler: async ({ body }, { params }) => {
            const id = Number(params.id)
            if (Number.isNaN(id)) {
              const data: LogIdPutResponse = {
                success: false,
                errors: { title: ['Invalid log id'] },
              }
              return { data }
            }

            const currentLog = await getLog(id)
            if (!currentLog) {
              const data: LogIdPutResponse = {
                success: false,
                errors: { title: ['Log not found'] },
              }
              return { data }
            }

            const { title, description, categories, imageDescription } = body

            const [updated] = await db
              .update(log)
              .set({
                title,
                description,
                imageDescription,
                updatedAt: Date.now(),
                // Regenerate image only when the prompt changes.
                status:
                  imageDescription !== currentLog.imageDescription
                    ? LogStatus.Created
                    : currentLog.status,
              })
              .where(eq(log.id, id))
              .returning()

            await db.delete(logCategory).where(eq(logCategory.logId, id))

            if (categories.length > 0) {
              await db
                .insert(logCategory)
                .values(categories.map((category) => ({ logId: id, categoryId: category })))
            }

            const outcome = await imagePipeline.generateImageFor(updated.id)
            logPipelineOutcome(outcome, 'PUT /api/log/$id')

            const data: LogIdPutResponse = { success: true, data: updated }
            return { data, invalidate: ['logs', `log:${id}`] }
          },
        }),
        DELETE: method<LogIdDeleteBody, undefined, undefined, LogIdDeleteResponse>({
          body: deleteSchema,
          reporter: deleteReporter,
          handler: async (_input, { params }) => {
            // Note: body validation has already enforced the secret. The id
            // check is inline to preserve the pre-refactor `{ error: 'Invalid log id' }`
            // shape for non-numeric ids (which is distinct from the validation
            // failure shape the envelope would produce for a bad secret).
            const id = Number(params.id)
            if (Number.isNaN(id)) {
              const data: LogIdDeleteResponse = { success: false, error: 'Invalid log id' }
              return { data }
            }

            await db.delete(log).where(eq(log.id, id))
            await deleteFromR2(id)

            const data: LogIdDeleteResponse = { success: true }
            return { data, invalidate: ['logs', `log:${id}`] }
          },
        }),
      },
      { route: '/api/log/$id' },
    ),
  },
})
