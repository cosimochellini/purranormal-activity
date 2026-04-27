import { TELEGRAM_BOT_CHAT_IDS } from '@/env/telegram'
import { imagePipeline } from '@/services/imagePipeline'
import { sendMessage as telegramSendMessage } from '@/services/telegram'
import { logger } from '@/utils/logger'
import { assertNever } from '@/utils/typed'

const formatCause = (value: unknown) =>
  value instanceof Error ? value.message : JSON.stringify(value)

// Telegram's default sendMessage parse_mode is HTML. Raw error text frequently
// contains '<', '>', '&' (e.g. "Cannot read properties of <undefined>"), which
// the HTML parser rejects with "Bad Request: can't parse entities" — making
// the loud alert silently fail. Escape to keep the spec's "never silent"
// contract intact.
const escapeHTML = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const alertWriteAlsoFailed = async (logId: number, cause: unknown, writeError: unknown) => {
  if (TELEGRAM_BOT_CHAT_IDS.length === 0) return

  const text = [
    '🚨 Image pipeline write-also-failed',
    `logId: ${logId}`,
    `cause: ${escapeHTML(formatCause(cause))}`,
    `writeError: ${escapeHTML(formatCause(writeError))}`,
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

export interface RunImageGenerationScriptResponse {
  success: boolean
  processed: number
  error?: string
}

export async function runImageGenerationScript(): Promise<RunImageGenerationScriptResponse> {
  let processed = 0

  try {
    while (true) {
      const outcome = await imagePipeline.drainOnePending()
      if (!outcome) break
      processed++

      switch (outcome.kind) {
        case 'success':
          break
        case 'skipped':
          logger.warn(`Skipped log ${outcome.logId}: ${outcome.reason}`)
          break
        case 'failed-recorded':
          logger.error(`Image pipeline recorded an error for log ${outcome.logId}`, {
            cause: outcome.cause,
          })
          break
        case 'failed-write-also-failed':
          logger.error(`Image pipeline failed to write the error column for log ${outcome.logId}`, {
            cause: outcome.cause,
            writeError: outcome.writeError,
          })
          await alertWriteAlsoFailed(outcome.logId, outcome.cause, outcome.writeError)
          break
        default:
          return assertNever(outcome)
      }
    }

    return {
      success: true,
      processed,
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
