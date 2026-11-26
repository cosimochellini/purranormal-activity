import type { SQL } from 'drizzle-orm'
import { and, asc, desc, eq, gte, inArray, like, or, sql } from 'drizzle-orm'
import type { Log } from '../db/schema'
import { log, logCategory } from '../db/schema'
import { db } from '../drizzle'
import { SortBy, TimeRange } from '../types/search'
import { time } from '../utils/time'

const sorting = {
  [SortBy.Recent]: [desc(log.id)],
  [SortBy.Oldest]: [asc(log.id)],
  [SortBy.Title]: [asc(log.title)],
} as const satisfies Record<SortBy, SQL[]>

// Window lengths, not cutoffs: the cutoff is taken per query. A module-level
// `Date.now()` would freeze at isolate start and drift on a long-lived Worker.
const rangeMs = {
  [TimeRange.All]: 0,
  [TimeRange.Day]: time({ days: 1 }),
  [TimeRange.Week]: time({ days: 7 }),
  [TimeRange.Month]: time({ days: 30 }),
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

  const categoriesMap = new Map<number, number[]>()
  for (const { logId, categoryId } of categoryRelations) {
    const categories = categoriesMap.get(logId)
    if (categories) {
      categories.push(categoryId)
    } else {
      categoriesMap.set(logId, [categoryId])
    }
  }

  return logs.map((log) => ({
    ...log,
    categories: categoriesMap.get(log.id) ?? [],
  }))
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
    timeRange !== TimeRange.All ? gte(log.createdAt, Date.now() - rangeMs[timeRange]) : undefined

  const logs = await db
    .select()
    .from(log)
    .where(and(gte(log.id, 1), searchCondition, categoryCondition, timeRangeCondition))
    .orderBy(...sorting[sortBy])
    .limit(limit)
    .offset(skip)

  return addCategories(logs)
}
