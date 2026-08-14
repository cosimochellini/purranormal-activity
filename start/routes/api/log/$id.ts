import { createFileRoute } from '@tanstack/react-router'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { ARRAY_LIMITS, CHARACTER_LIMITS, VALIDATION_MESSAGES } from '@/constants'
import { LogStatus } from '@/data/enum/logStatus'
import { log, logCategory } from '@/db/schema'
import { db } from '@/drizzle'
import { serverEnv } from '@/env/server'
import { imagePipeline } from '@/services/imagePipeline'
import { imageStore } from '@/services/imageStore/r2.server'
import { defineHandlers, method } from '@/services/route/defineHandlers'
import type { LogIdDeleteResponse, LogIdGetResponse, LogIdPutResponse } from '@/types/api/log-id'
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
  secret: z.string().refine((val) => val === serverEnv.secret, { message: 'Invalid secret' }),
})

const deleteSchema = z.object({
  secret: z.string().refine((val) => val === serverEnv.secret, { message: 'Invalid secret' }),
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

const readJson = async (request: Request): Promise<unknown> => {
  try {
    return await request.json()
  } catch {
    return {}
  }
}

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
        // PUT does its own body validation INSIDE the handler so the id-guard
        // can fire first (pre-refactor: bad-id + bad-body → `{ title: ['Invalid log id'] }`).
        // Envelope owns the catch path + scoped logger only.
        PUT: method<undefined, undefined, undefined, LogIdPutResponse>({
          reporter: putReporter,
          handler: async (_input, { request, params }) => {
            const id = Number(params.id)
            if (Number.isNaN(id)) {
              const data: LogIdPutResponse = {
                success: false,
                errors: { title: ['Invalid log id'] },
              }
              return { data }
            }

            const raw = await readJson(request)
            const result = await putSchema.safeParseAsync(raw)
            if (!result.success) {
              const data: LogIdPutResponse = {
                success: false,
                errors: result.error.flatten().fieldErrors,
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

            const { title, description, categories, imageDescription } = result.data

            // Regenerate image only when the prompt changes.
            const promptChanged = imageDescription !== currentLog.imageDescription

            const [updated] = await db
              .update(log)
              .set({
                title,
                description,
                imageDescription,
                updatedAt: Date.now(),
                status: promptChanged ? LogStatus.Created : currentLog.status,
                // A new prompt is a new generation cycle: fresh attempt budget,
                // and the previous failure text no longer describes this row.
                ...(promptChanged ? { attempts: 0, error: null } : {}),
              })
              .where(eq(log.id, id))
              .returning()

            await db.delete(logCategory).where(eq(logCategory.logId, id))

            if (categories.length > 0) {
              await db
                .insert(logCategory)
                .values(categories.map((category) => ({ logId: id, categoryId: category })))
            }

            // Enqueue instead of generating inline. The gate is new: the old
            // unconditional call relied on the pipeline's own `not-pending`
            // skip, which under a queue costs a message plus a DB round trip
            // to reach the same conclusion.
            if (promptChanged || currentLog.status === LogStatus.Created) {
              await imagePipeline.enqueue(updated.id, 'update')
            }

            const data: LogIdPutResponse = { success: true, data: updated }
            return { data, invalidate: ['logs', `log:${id}`] }
          },
        }),
        // DELETE: body validation lives in the handler so a wrong secret emits
        // the legacy `{ success: false, error: 'Invalid secret' }` shape rather
        // than the envelope's `{ errors: { secret: [...] } }` shape.
        DELETE: method<undefined, undefined, undefined, LogIdDeleteResponse>({
          reporter: deleteReporter,
          handler: async (_input, { request, params }) => {
            const raw = await readJson(request)
            const parsed = deleteSchema.safeParse(raw)
            if (!parsed.success) {
              const data: LogIdDeleteResponse = { success: false, error: 'Invalid secret' }
              return { data }
            }

            const id = Number(params.id)
            if (Number.isNaN(id)) {
              const data: LogIdDeleteResponse = { success: false, error: 'Invalid log id' }
              return { data }
            }

            await db.delete(log).where(eq(log.id, id))
            await imageStore.delete(id)

            const data: LogIdDeleteResponse = { success: true }
            return { data, invalidate: ['logs', `log:${id}`] }
          },
        }),
      },
      { route: '/api/log/$id' },
    ),
  },
})
