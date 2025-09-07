import type { SQL } from 'drizzle-orm'
import { and, asc, desc, eq, gte, inArray, like, or, sql } from 'drizzle-orm'
import type { Log, LogWithCategories } from '../db/schema'
import { log, logCategory } from '../db/schema'
import { db } from '../drizzle'
import { SortBy, TimeRange } from '../types/search'
import { logger } from '../utils/logger'
import { time } from '../utils/time'

const sorting = {
  [SortBy.Recent]: [desc(log.id)],
  [SortBy.Oldest]: [asc(log.id)],
  [SortBy.Title]: [asc(log.title)],
} as const satisfies Record<SortBy, SQL[]>

const now = Date.now()

const ranges = {
  [TimeRange.All]: 0,
  [TimeRange.Day]: now - time({ days: 1 }),
  [TimeRange.Week]: now - time({ days: 7 }),
  [TimeRange.Month]: now - time({ days: 30 }),
} as const satisfies Record<TimeRange, number>

async function addCategories(logs: Log[]) {
  const logIds = logs.map((log) => log.id)
  const categoryRelations = await db
    .select({
      logId: logCategory.logId,
      categoryId: logCategory.categoryId,
    })
    .from(logCategory)
    .where(inArray(logCategory.logId, logIds))

  const data = [] as LogWithCategories[]

  for (const log of logs) {
    const categories = categoryRelations
      .filter(({ logId }) => logId === log.id)
      .map(({ categoryId }) => categoryId)

    data.push({ ...log, categories })
  }

  return data
}

export async function getLog(id: number) {
  const [entry] = await db.select().from(log).where(eq(log.id, id))

  if (!entry) return null

  const [result] = await addCategories([entry])

  return result
}

interface GetLogsOptions {
  skip?: number
  limit?: number
  search?: string
  categories?: number[]
  sortBy?: SortBy
  timeRange?: TimeRange
}

export async function getLogs({
  skip = 0,
  limit = 10,
  search = '',
  categories = [],
  sortBy = SortBy.Recent,
  timeRange = TimeRange.All,
}: GetLogsOptions) {
  const categoryCondition =
    categories.length > 0
      ? sql`
    ${log.id} IN (${db
      .select({ logId: logCategory.logId })
      .from(logCategory)
      .where(inArray(logCategory.categoryId, categories))
      .groupBy(logCategory.logId)})
      `
      : undefined

  const searchCondition = search
    ? or(like(log.title, `%${search}%`), like(log.description, `%${search}%`))
    : undefined

  const timeRangeCondition =
    timeRange !== TimeRange.All ? gte(log.createdAt, ranges[timeRange]) : undefined

  const logs = await db
    .select()
    .from(log)
    .where(and(gte(log.id, 1), searchCondition, categoryCondition, timeRangeCondition))
    .orderBy(...sorting[sortBy])
    .limit(limit)
    .offset(skip)

  return addCategories(logs)
}

export async function setLogError(id: number | undefined, error: unknown) {
  try {
    if (!id) return

    await db
      .update(log)
      .set({ error: error instanceof Error ? error.message : JSON.stringify(error) })
      .where(eq(log.id, id))
  } catch (error) {
    logger.error('Failed to set log error:', error)
  }
}
