import { migrateCategories } from '../../../scripts/migrate-categories'
import { logger } from '../../../utils/logger'

export const runtime = 'edge'
export async function GET() {
  await migrateCategories().catch(logger.error)

  return new Response('Categories migration completed', { status: 200 })
}
