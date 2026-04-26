import { eq } from 'drizzle-orm'
import { LogStatus } from '@/data/enum/logStatus'
import { log } from '@/db/schema'
import { db } from '@/drizzle'
import { TELEGRAM_BOT_CHAT_IDS } from '@/env/telegram'
import { imagePipeline } from '@/services/imagePipeline'
import { sendMessage as telegramSendMessage } from '@/services/telegram'
import { batch } from '@/utils/batch'
import { logger } from '@/utils/logger'
import { wait } from '@/utils/promise'
import { assertNever } from '@/utils/typed'

const BATCH_SIZE = 5
const DELAY_MS = 5000

const formatCause = (value: unknown) =>
  value instanceof Error ? value.message : JSON.stringify(value)

const alertWriteAlsoFailed = async (logId: number, cause: unknown, writeError: unknown) => {
  if (TELEGRAM_BOT_CHAT_IDS.length === 0) return

  const text = [
    '🚨 Image pipeline write-also-failed',
    `logId: ${logId}`,
    `cause: ${formatCause(cause)}`,
    `writeError: ${formatCause(writeError)}`,
  ].join('\n')

  await Promise.all(
    TELEGRAM_BOT_CHAT_IDS.map(async (chatId) => {
      try {
        const result = await telegramSendMessage(chatId, text)
        if (!result.success) {
          logger.error('Pipeline alert: Telegram rejected the message', {
            chatId,
            logId,
            error: result.error,
          })
        }
      } catch (error) {
        logger.error('Pipeline alert: Telegram threw while sending', {
          chatId,
          logId,
          error,
        })
      }
    }),
  )
}

async function processLog(logEntry: { id: number }) {
  logger.info(`Processing log ${logEntry.id}`)

  const outcome = await imagePipeline.run(logEntry.id)

  switch (outcome.kind) {
    case 'success':
      return
    case 'skipped':
      logger.warn(`Skipped log ${logEntry.id}: ${outcome.reason}`)
      return
    case 'failed-recorded':
      logger.error(`Image pipeline recorded an error for log ${logEntry.id}`, {
        cause: outcome.cause,
      })
      return
    case 'failed-write-also-failed':
      logger.error(`Image pipeline failed to write the error column for log ${logEntry.id}`, {
        cause: outcome.cause,
        writeError: outcome.writeError,
      })
      await alertWriteAlsoFailed(outcome.logId, outcome.cause, outcome.writeError)
      return
    default:
      return assertNever(outcome)
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
