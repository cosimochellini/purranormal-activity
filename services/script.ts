import { eq } from 'drizzle-orm'
import { LogStatus } from '@/data/enum/logStatus'
import { log } from '@/db/schema'
import { db } from '@/drizzle'
import { invalidatePublicContent } from '@/services/content'
import { generateLogImage } from '@/services/trigger'
import { batch } from '@/utils/batch'
import { logger } from '@/utils/logger'
import { wait } from '@/utils/promise'

const BATCH_SIZE = 5
const DELAY_MS = 5000

async function processLog(logEntry: { id: number }) {
  try {
    logger.info(`Processing log ${logEntry.id}`)
    await generateLogImage(logEntry.id)
  } catch (error) {
    logger.error(`Failed to process log ${logEntry.id}:`, error)
  }
}

export interface RunImageGenerationScriptResponse {
  success: boolean
  processed: number
  error?: string
}

export async function runImageGenerationScript(): Promise<RunImageGenerationScriptResponse> {
  try {
    const logs = await db.select({ id: log.id }).from(log).where(eq(log.status, LogStatus.Created))
    const logBatches = batch(logs, BATCH_SIZE)

    for (const logBatch of logBatches) {
      await Promise.all(logBatch.map(processLog))
      await wait(DELAY_MS)
    }

    if (logs.length > 0) {
      await invalidatePublicContent()
    }

    return {
      success: true,
      processed: logs.length,
    }
  } catch (error) {
    logger.error('Failed to process logs:', error)

    return {
      success: false,
      processed: 0,
      error: 'Failed to process logs',
    }
  }
}
