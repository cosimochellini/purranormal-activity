import { LogStatus } from '@/data/enum/logStatus'
import { log } from '@/db/schema'
import { db } from '@/drizzle'
import { NEXT_PUBLIC_APP_URL } from '@/env/next'
import { ok } from '@/utils/http'
import { wait } from '@/utils/promise'
import { eq } from 'drizzle-orm'
import { logger } from '../../../../utils/logger'

export const runtime = 'edge'

export async function POST() {
  try {
    // Get all logs with Created status
    const logs = await db
      .select({ id: log.id })
      .from(log)
      .where(eq(log.status, LogStatus.Created))

    // Process each log with 5 second delay between requests
    for (const logEntry of logs) {
      try {
        logger.info(`Processing log ${logEntry.id}`)

        fetch(`${NEXT_PUBLIC_APP_URL}/api/trigger/${logEntry.id}`, {
          method: 'POST',
        })

        await wait(5000)
      }
      catch (error) {
        logger.error(`Failed to process log ${logEntry.id}:`, error)
      }
    }

    return ok({
      success: true,
      processed: logs.length,
    })
  }
  catch {
    return ok({
      success: false,
      error: 'Failed to process logs',
    })
  }
}
