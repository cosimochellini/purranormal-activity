import type { Category, Log, LogWithCategories } from '../db/schema'
import { desc, eq, inArray } from 'drizzle-orm'
import { log, logCategory } from '../db/schema'
import { db } from '../drizzle'
import { getCategoriesMap } from './categories'

async function addCategories(logs: Log[]) {
  const categoriesMap = await getCategoriesMap()

  const logIds = logs.map(log => log.id)
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
      .map(({ categoryId }) => categoriesMap.get(categoryId))
      .filter(Boolean) as Category[]

    data.push({ ...log, categories })
  }

  return data
}

export async function getLog(id: number) {
  const [entry] = await db
    .select()
    .from(log)
    .where(eq(log.id, id))

  if (!entry)
    return null

  const [result] = await addCategories([entry])

  return result
}

export async function getLogs(skip: number, limit: number) {
  const logs = await db
    .select()
    .from(log)
    .orderBy(desc(log.id))
    .limit(limit)
    .offset(skip)

  return addCategories(logs)
}
