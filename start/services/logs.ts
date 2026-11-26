import { createMiddleware, createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { z } from 'zod'
import { VALIDATION_MESSAGES } from '@/constants'
import { category } from '@/db/schema'
import { db } from '@/drizzle'
import { serverEnv } from '@/env/server'
import { purgePages } from '@/services/edgeCache.server'
import { getLog, getLogs } from '@/services/log'
import {
  deleteLog as deleteLogAction,
  listLogs as listLogsAction,
  notifyLog as notifyLogAction,
  refineLog as refineLogAction,
  submitLog as submitLogAction,
  updateLog as updateLogAction,
  uploadCover as uploadCoverAction,
} from '@/services/logActions.server'
import type { LogIdDeleteBody, LogIdPutBody } from '@/types/api/log-id'
import type { LogRefineBody } from '@/types/api/log-refine'
import type { LogSubmitBody } from '@/types/api/log-submit'
import { exploreSearchSchema } from '@/types/search'
import { logger } from '@/utils/logger'
import { readSecret } from '@/utils/secret'

/**
 * The app's server functions: every read and write the UI performs. Logic
 * lives in `services/logActions.server.ts`; this file is transport only.
 *
 * Form functions take a typed identity validator: the action safe-parses the
 * payload itself, so a bad field comes back as a field error rather than a
 * thrown validation error.
 */

export const HOME_PAGE_SIZE = 6 * 3

/**
 * Gate for every write. Runs before the function's own validator, so it reads
 * the raw payload (an object or an upload's `FormData`). Same rule as the
 * operator routes and the old submit/upload endpoints: the input is lowercased
 * and compared to `SECRET`, which is stored lowercase.
 */
const secretMiddleware = createMiddleware({ type: 'function' }).server(({ data, next }) => {
  const secret = readSecret(data)
  if (!secret) throw new Error(VALIDATION_MESSAGES.SECRET_REQUIRED)
  let expected: string
  try {
    expected = serverEnv.secret
  } catch (error) {
    // Missing `SECRET`: log the config error, don't ship its text to the browser.
    logger.error('secretMiddleware:', error)
    throw new Error('Unable to verify the secret right now')
  }
  if (secret.toLowerCase() !== expected) {
    throw new Error(VALIDATION_MESSAGES.SECRET_INVALID)
  }
  return next()
})

/** Drop the edge-cached pages a write to log `id` makes stale. */
const purgeLogPages = (id: number) =>
  purgePages(new URL(getRequest().url).origin, ['/', '/explore', `/${id}`])

// --- reads ------------------------------------------------------------------

export const getLogById = createServerFn({ method: 'GET' })
  .validator(z.object({ id: z.number().int().positive() }))
  .handler(async ({ data }) => {
    try {
      return await getLog(data.id)
    } catch (error) {
      logger.error(`Failed to load log ${data.id}:`, error)
      return null
    }
  })

export const getRecentLogs = createServerFn({ method: 'GET' }).handler(async () => {
  try {
    return await getLogs({ skip: 0, limit: HOME_PAGE_SIZE })
  } catch (error) {
    logger.error('Failed to load recent logs for home route:', error)
    return []
  }
})

// Thrown errors are serialized to the browser with their message, so a DB
// error (SQL, params) is logged here and replaced with a fixed one.
export const listLogs = createServerFn({ method: 'GET' })
  .validator(exploreSearchSchema)
  .handler(async ({ data }) => {
    try {
      return await listLogsAction(data)
    } catch (error) {
      logger.error('Failed to list logs:', error)
      throw new Error('Failed to fetch logs')
    }
  })

// ponytail: categories only change by hand in the DB, so one read per isolate.
// Add a TTL if categories ever become editable at runtime.
let categoriesCache: (typeof category.$inferSelect)[] | undefined

/**
 * Never throws: any failure (DB or a missing env, which throws synchronously)
 * is logged and degrades to no categories. Only a non-empty read is memoised,
 * so a blip or an unseeded table is retried on the next call.
 */
export const getCategories = createServerFn({ method: 'GET' }).handler(async () => {
  if (categoriesCache) return categoriesCache
  try {
    const rows = await db.select().from(category)
    if (rows.length > 0) categoriesCache = rows
    return rows
  } catch (error) {
    logger.error('Failed to load categories:', error)
    return []
  }
})

// --- writes -----------------------------------------------------------------

/** Step 1 of `/new`. Public: it only asks the LLM for follow-up questions. */
export const refineLog = createServerFn({ method: 'POST' })
  .validator((data: LogRefineBody) => data)
  .handler(({ data }) => refineLogAction(data))

export const submitLog = createServerFn({ method: 'POST' })
  .middleware([secretMiddleware])
  .validator((data: LogSubmitBody) => data)
  .handler(async ({ data }) => {
    const result = await submitLogAction(data)
    if (result.success) await purgeLogPages(result.id)
    return result
  })

export const updateLog = createServerFn({ method: 'POST' })
  .middleware([secretMiddleware])
  .validator((data: LogIdPutBody) => data)
  .handler(async ({ data }) => {
    const result = await updateLogAction(data)
    if (result.success) await purgeLogPages(result.data.id)
    return result
  })

export const deleteLog = createServerFn({ method: 'POST' })
  .middleware([secretMiddleware])
  .validator((data: LogIdDeleteBody) => data)
  .handler(async ({ data }) => {
    const result = await deleteLogAction(data.id)
    if (result.success) await purgeLogPages(data.id)
    return result
  })

/** Expects `FormData` with `id`, `file` and `secret`. */
export const uploadCover = createServerFn({ method: 'POST' })
  .middleware([secretMiddleware])
  .validator((data: FormData) => {
    if (!(data instanceof FormData)) throw new Error('Expected multipart form data')
    return data
  })
  .handler(async ({ data }) => {
    const result = await uploadCoverAction(data)
    if (result.success) await purgeLogPages(Number(data.get('id')))
    return result
  })

export const notifyLog = createServerFn({ method: 'POST' })
  .middleware([secretMiddleware])
  .validator((data: { id: number; secret: string }) => data)
  .handler(({ data }) => notifyLogAction(data.id))
