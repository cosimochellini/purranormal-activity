import { LogStatus } from '@/data/enum/logStatus'
import { log } from '@/db/schema'
import { db } from '@/drizzle'
import { NEXT_PUBLIC_APP_URL } from '@/env/next'
import { batch } from '@/utils/batch'
import { ok } from '@/utils/http'
import { logger } from '@/utils/logger'
import { wait } from '@/utils/promise'
import { eq } from 'drizzle-orm'

export const runtime = 'edge'

const BATCH_SIZE = 5
const DELAY_MS = 5000

async function processLog(logEntry: { id: number }) {
  try {
    logger.info(`Processing log ${logEntry.id}`)

    fetch(`${NEXT_PUBLIC_APP_URL}/api/trigger/${logEntry.id}`, {
      method: 'POST',
    })
  } catch (error) {
    logger.error(`Failed to process log ${logEntry.id}:`, error)
  }
}

export async function POST() {
  try {
    const logs = await db.select({ id: log.id }).from(log).where(eq(log.status, LogStatus.Created))

    const logBatches = batch(logs, BATCH_SIZE)

    for (const logBatch of logBatches) {
      await Promise.all(logBatch.map(processLog))

      await wait(DELAY_MS)
    }

    return ok({
      success: true,
      processed: logs.length,
    })
  } catch (error) {
    logger.error('Failed to process logs:', error)

    return ok({
      success: false,
      error: 'Failed to process logs',
    })
  }
}
