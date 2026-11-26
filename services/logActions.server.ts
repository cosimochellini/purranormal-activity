import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { ARRAY_LIMITS, CHARACTER_LIMITS, UPLOAD_LIMITS, VALIDATION_MESSAGES } from '@/constants'
import { LogStatus } from '@/data/enum/logStatus'
import { log, logCategory } from '@/db/schema'
import { db } from '@/drizzle'
import { createFriendly, type FriendlyMessages, isAiResultError } from '@/services/friendly'
import { imagePipeline } from '@/services/imagePipeline'
import { imageStore } from '@/services/imageStore/r2.server'
import { getLog, getLogs } from '@/services/log'
import { notifier } from '@/services/notifier'
import { storyForge } from '@/services/storyForge'
import type { LogIdDeleteResponse, LogIdPutResponse } from '@/types/api/log-id'
import type { LogRefineResponse } from '@/types/api/log-refine'
import type { LogSubmitResponse } from '@/types/api/log-submit'
import type { TelegramIdResponse } from '@/types/api/telegram-id'
import type { UploadIdResponse } from '@/types/api/upload-id'
import type { ExploreSearch } from '@/types/search'
import { logger } from '@/utils/logger'

/**
 * Server-side logic behind the app's server functions (`start/services/logs.ts`).
 *
 * Kept as plain async functions so tests can call them without the Start
 * compiler. Each returns the same `{ success, ... }` value the old `/api/*`
 * routes put in their JSON body: validation and expected failures are values,
 * not throws, so forms can show field errors. The secret is checked by
 * `secretMiddleware` before any of these run, so no schema here repeats it.
 */

const AI_COPY = {
  AI_UNAVAILABLE:
    'Our mystical AI assistant is temporarily unavailable. Please try again in a moment.',
  AI_UNEXPECTED_RESPONSE:
    'Our mystical AI assistant returned an unexpected response. Please try again.',
  CONNECTION_ISSUE: 'Connection issue detected. Please check your internet and try again.',
} as const

const fieldErrors = (error: z.ZodError) =>
  z.flattenError(error).fieldErrors as Record<string, string[]>

// --- list -------------------------------------------------------------------

export interface LogPage {
  logs: Awaited<ReturnType<typeof getLogs>>
  hasMore: boolean
  nextPage: number | null
}

/** One page of logs. Throws on a DB failure: loaders surface it via the error boundary. */
export const listLogs = async ({
  page,
  limit,
  search,
  categories,
  sortBy,
  timeRange,
}: ExploreSearch): Promise<LogPage> => {
  const logs = await getLogs({
    skip: (page - 1) * limit,
    limit,
    search,
    categories,
    sortBy,
    timeRange,
  })
  const hasMore = logs.length === limit
  return { logs, hasMore, nextPage: hasMore ? page + 1 : null }
}

// --- refine -----------------------------------------------------------------

const refineSchema = z.object({
  description: z
    .string()
    .min(ARRAY_LIMITS.MIN_REQUIRED, VALIDATION_MESSAGES.DESCRIPTION_REQUIRED)
    .max(CHARACTER_LIMITS.REFINEMENT_DESCRIPTION, VALIDATION_MESSAGES.DESCRIPTION_TOO_LONG),
})

const refineReporter = createFriendly<LogRefineResponse>({
  messages: {
    ...AI_COPY,
    REQUEST_TIMEOUT: 'The request took too long. Please try with a shorter description.',
    GENERIC_FALLBACK: 'Unable to generate questions for your event. Please try again.',
  },
  build: (text) => ({ success: false, errors: { description: [text] } }),
  onError: (error) =>
    isAiResultError(error)
      ? logger.error('storyForge.questions returned !ok', error)
      : logger.error('Failed to generate follow-up questions:', error),
})

export const refineLog = (input: unknown): Promise<LogRefineResponse> =>
  refineReporter.guard(async () => {
    const parsed = refineSchema.safeParse(input)
    if (!parsed.success) return { success: false, errors: fieldErrors(parsed.error) }

    const result = refineReporter.fromAi(await storyForge.questions(parsed.data.description))
    if (!result.ok) return result.response
    return { success: true, content: result.value }
  })

// --- submit -----------------------------------------------------------------

const submitSchema = z.object({
  description: z
    .string()
    .min(ARRAY_LIMITS.MIN_REQUIRED, VALIDATION_MESSAGES.DESCRIPTION_REQUIRED)
    .max(CHARACTER_LIMITS.DESCRIPTION, VALIDATION_MESSAGES.DESCRIPTION_TOO_LONG),
  answers: z
    .array(z.object({ question: z.string(), answer: z.string() }))
    .max(ARRAY_LIMITS.MAX_ANSWERS, VALIDATION_MESSAGES.ANSWERS_TOO_MANY),
})

const submitMessages: FriendlyMessages = {
  ...AI_COPY,
  REQUEST_TIMEOUT: 'The request took too long. Please try with a shorter description.',
  GENERIC_FALLBACK: 'Unable to process your paranormal event. Please try again.',
  DB_UNAVAILABLE: 'Unable to save the event at this time. Please try again shortly.',
}

const submitReporter = createFriendly<LogSubmitResponse>({
  messages: submitMessages,
  build: (text) => ({ success: false, errors: { general: [text] } }),
  onError: (error) =>
    isAiResultError(error)
      ? logger.error('storyForge.logDetails returned !ok', error)
      : logger.error('Failed to submit log:', error),
})

export const submitLog = (input: unknown): Promise<LogSubmitResponse> =>
  submitReporter.guard(async () => {
    const parsed = submitSchema.safeParse(input)
    if (!parsed.success) return { success: false, errors: fieldErrors(parsed.error) }

    const details = submitReporter.fromAi(
      await storyForge.logDetails(parsed.data.description, parsed.data.answers),
    )
    if (!details.ok) return details.response

    const { title, description, categories, imageDescription } = details.value

    // Every realistic failure here is the categories DB read; keep the explicit
    // DB copy rather than letting the thrown-error matcher guess.
    let allCategoryIds: number[]
    try {
      allCategoryIds = (await storyForge.categories()).map((c) => c.id)
    } catch (error) {
      logger.error('storyForge.categories() failed during submit:', error)
      return {
        success: false,
        errors: { general: [submitMessages.DB_UNAVAILABLE ?? submitMessages.GENERIC_FALLBACK] },
      }
    }

    // The pipeline inserts the row and enqueues the image job; generation
    // happens on the queue consumer, so this returns in milliseconds.
    const { id, enqueued } = await imagePipeline.submit({
      draft: { title, description, imageDescription },
      categoryIds: categories.map((c) => c.id).filter((cid) => allCategoryIds.includes(cid)),
    })

    // The row is saved and the cron sweeper will pick it up, but a failed
    // enqueue means the queue itself is unreachable: make it visible.
    if (!enqueued) logger.error(`submit: log ${id} was saved but not enqueued`)

    return { success: true, id }
  })

// --- update -----------------------------------------------------------------

const updateSchema = z.object({
  id: z.number().int().positive(),
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
})

const writeMessages: FriendlyMessages = {
  ...AI_COPY,
  REQUEST_TIMEOUT: 'The request took too long. Please try again.',
  GENERIC_FALLBACK: 'Failed to update log',
  DB_UNAVAILABLE: 'Failed to update log',
}

const updateReporter = createFriendly<LogIdPutResponse>({
  messages: writeMessages,
  build: (text) => ({ success: false, errors: { title: [text] } }),
  onError: (error) => logger.error('Failed to update log:', error),
})

export const updateLog = (input: unknown): Promise<LogIdPutResponse> =>
  updateReporter.guard(async () => {
    const parsed = updateSchema.safeParse(input)
    if (!parsed.success) return { success: false, errors: fieldErrors(parsed.error) }

    const { id, title, description, categories, imageDescription } = parsed.data
    const [current] = await db.select().from(log).where(eq(log.id, id))
    if (!current) return { success: false, errors: { title: ['Log not found'] } }

    // Regenerate the image only when the prompt changes.
    const promptChanged = imageDescription !== current.imageDescription

    const [updated] = await db
      .update(log)
      .set({
        title,
        description,
        imageDescription,
        updatedAt: Date.now(),
        status: promptChanged ? LogStatus.Created : current.status,
        // A new prompt is a new generation cycle: fresh attempt budget, and
        // the previous failure text no longer describes this row.
        ...(promptChanged ? { attempts: 0, error: null } : {}),
      })
      .where(eq(log.id, id))
      .returning()

    await db.delete(logCategory).where(eq(logCategory.logId, id))
    if (categories.length > 0) {
      await db
        .insert(logCategory)
        .values(categories.map((categoryId) => ({ logId: id, categoryId })))
    }

    // Anyone who puts a row into `Created` enqueues; only the consumer generates.
    if (promptChanged || current.status === LogStatus.Created) {
      await imagePipeline.enqueue(updated.id, 'update')
    }

    return { success: true, data: updated }
  })

// --- delete -----------------------------------------------------------------

const deleteReporter = createFriendly<LogIdDeleteResponse>({
  messages: { ...writeMessages, GENERIC_FALLBACK: 'Failed to delete log' },
  build: (text) => ({ success: false, error: text }),
  onError: (error) => logger.error('Failed to delete log:', error),
})

export const deleteLog = (id: number): Promise<LogIdDeleteResponse> =>
  deleteReporter.guard(async () => {
    if (!Number.isInteger(id) || id <= 0) return { success: false, error: 'Invalid log id' }

    await db.delete(log).where(eq(log.id, id))
    await imageStore.delete(id)
    return { success: true }
  })

// --- upload cover -----------------------------------------------------------

/**
 * Manual cover upload. Writes `<id>/cover.webp` and flips the row to
 * `ImageGenerated`, which publishes the bytes and takes the row out of the
 * cron sweeper's reach — hence the secret gate on its server function.
 */
export const uploadCover = async (form: FormData): Promise<UploadIdResponse> => {
  try {
    const file = form.get('file')
    const logId = Number(form.get('id'))

    if (!(file instanceof File)) return { success: false, error: 'File is required' }
    if (!Number.isInteger(logId) || logId <= 0) return { success: false, error: 'Invalid log ID' }
    // Any image format is accepted: the object is still stored as
    // `cover.webp`, and browsers sniff the real format in `<img>`.
    if (!file.type.startsWith('image/')) return { success: false, error: 'File must be an image' }
    if (file.size > UPLOAD_LIMITS.MAX_BYTES) {
      return { success: false, error: 'File is too large (max 5 MB)' }
    }

    // Checked before the R2 write: an unknown id would leave an orphan object
    // behind and the status update below would silently match zero rows.
    const row = await db.select({ id: log.id }).from(log).where(eq(log.id, logId)).get()
    if (!row) return { success: false, error: 'Log not found' }

    await imageStore.put(logId, new Uint8Array(await file.arrayBuffer()))

    // Without this the row stays `Created`, and the sweeper would overwrite
    // the hand-uploaded cover with a generated one.
    await db
      .update(log)
      .set({ status: LogStatus.ImageGenerated, error: null, attempts: 0, updatedAt: Date.now() })
      .where(eq(log.id, logId))

    return { success: true }
  } catch (error) {
    logger.error('Failed to upload cover:', error)
    return { success: false, error: `Failed to upload file ${error}` }
  }
}

// --- telegram notify --------------------------------------------------------

/**
 * Telegram fan-out for one log. Off the friendly classifier on purpose: the
 * raw cause string is the useful surface for this operator-facing action.
 */
export const notifyLog = async (id: number): Promise<TelegramIdResponse> => {
  try {
    if (!Number.isInteger(id) || id <= 0) return { success: false, error: 'Invalid event ID' }

    const event = await getLog(id)
    if (!event) return { success: false, error: 'Event not found' }

    const outcome = await notifier.notify(event)
    if (outcome.delivered) return { success: true, messageId: outcome.messageId ?? 0 }

    return {
      success: false,
      error: outcome.reachedChats === 0 ? 'Telegram fan-out failed' : 'Telegram fan-out partial',
      partial: {
        reachedChats: outcome.reachedChats,
        totalChats: outcome.totalChats,
        failedPhotoChats: outcome.failedPhotoChats,
      },
    }
  } catch (error) {
    logger.error('Telegram dispatch failed:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}
