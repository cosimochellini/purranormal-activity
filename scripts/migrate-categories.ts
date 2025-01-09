import { sql } from 'drizzle-orm'
import { Categories } from '../data/enum/category'
import { category, log, logCategory } from '../db/schema'
import { db } from '../drizzle'
import { typedObjectEntries } from '../utils/typed'

export async function migrateCategories() {
  // Insert all categories
  const categoryEntries = typedObjectEntries(Categories).map(([name, icon]) => ({
    name,
    icon,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }))

  await db.insert(category).values(categoryEntries)

  // Get all categories for mapping
  const categories = await db.select().from(category)
  const categoryMap = new Map(categories.map(c => [c.name, c.id]))

  // Get all logs
  const logs = await db.select().from(log)

  // For each log, parse categories and create relationships
  for (const logEntry of logs) {
    try {
      const oldCategories = JSON.parse(logEntry.categories as string) as Categories[]

      const categoryIds = oldCategories
        .map(c => categoryMap.get(c))
        .filter((id): id is number => id !== undefined)

      // Insert log-category relationships
      await db.insert(logCategory).values(
        categoryIds.map(categoryId => ({
          logId: logEntry.id,
          categoryId,
        })),
      )
    }
    catch (error) {
      console.error(`Failed to migrate categories for log ${logEntry.id}:`, error)
    }
  }

  // Remove old categories column
  await db.run(sql`ALTER TABLE log DROP COLUMN categories`)
}
