import type { Category } from '@/db/schema'
import { category } from '@/db/schema'
import { db } from '@/drizzle'
import { ok } from '@/utils/http'

export const runtime = 'edge'
export type GetResponse = Category[]
export async function GET() {
  const categories = await db.select().from(category)

  return ok<GetResponse>(categories)
}
