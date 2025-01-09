import { category, type Category } from '../db/schema'
import { db } from '../drizzle'

let cachedCategories: Map<number, Category> | null = null

export async function getCategoriesMap(force = false) {
  if (!force && (cachedCategories?.size ?? 0) > 0)
    return cachedCategories!

  const categories = await db.select().from(category)

  cachedCategories = new Map(categories.map(category => [category.id, category]))

  return cachedCategories
}

export async function getCategory(id: number) {
  const categories = await getCategoriesMap()
  return categories.get(id)
}

export async function getCategories() {
  const categories = await getCategoriesMap()
  return Array.from(categories.values())
}
