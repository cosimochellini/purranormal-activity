import { createFileRoute } from '@tanstack/react-router'
import { eq } from 'drizzle-orm'
import { LogStatus } from '@/data/enum/logStatus'
import { log } from '@/db/schema'
import { db } from '@/drizzle'
import { generateLogImage } from '@/services/trigger'
import { batch } from '@/utils/batch'
import { ok } from '@/utils/http'
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

export const Route = createFileRoute('/api/trigger/images')({
  server: {
    handlers: {
      POST: async () => {
        try {
          const logs = await db
            .select({ id: log.id })
            .from(log)
            .where(eq(log.status, LogStatus.Created))

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
      },
    },
  },
})
