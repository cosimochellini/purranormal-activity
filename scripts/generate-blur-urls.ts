/* eslint-disable node/prefer-global/process */
import { eq } from 'drizzle-orm'
import { LogStatus } from '../data/enum/logStatus'
import { log } from '../db/schema'
import { db } from '../drizzle'
import { batch } from '../utils/batch'
import { publicImage } from '../utils/cloudflare'
import { downloadImageAsBuffer, generateBlurDataURL } from '../utils/image'
import { logger } from '../utils/logger'

const BATCH_SIZE = 5
const DELAY_MS = 1000

async function processLog(logEntry: { id: number }) {
  try {
    logger.info(`Processing log ${logEntry.id}`)

    // Get full log details
    const [entry] = await db
      .select()
      .from(log)
      .where(eq(log.id, logEntry.id))

    if (!entry || entry.status !== LogStatus.ImageGenerated) {
      logger.info(`Skipping log ${logEntry.id} - not ready`)
      return
    }

    if (entry.blurDataURL) {
      logger.info(`Skipping log ${logEntry.id} - already has blur URL`)
      return
    }

    // Download image from R2
    const imageUrl = publicImage(entry.id)
    const buffer = await downloadImageAsBuffer(imageUrl)

    // Generate blur data URL
    const blurDataURL = await generateBlurDataURL(buffer)

    // Update database
    await db
      .update(log)
      .set({ blurDataURL })
      .where(eq(log.id, entry.id))

    logger.info(`Updated blur URL for log ${entry.id}`)
  }
  catch (error) {
    logger.error(`Failed to process log ${logEntry.id}:`, error)
  }
}

export async function run() {
  try {
    // Get all logs
    const logs = await db
      .select({ id: log.id })
      .from(log)
      .where(eq(log.status, LogStatus.ImageGenerated))

    logger.info(`Found ${logs.length} logs to process`)

    // Process in batches
    const logBatches = batch(logs, BATCH_SIZE)

    for (const logBatch of logBatches) {
      await Promise.all(logBatch.map(processLog))
      await new Promise(resolve => setTimeout(resolve, DELAY_MS))
    }

    logger.info('Completed processing all logs')
  }
  catch (error) {
    logger.error('Script failed:', error)
    process.exit(1)
  }
}
