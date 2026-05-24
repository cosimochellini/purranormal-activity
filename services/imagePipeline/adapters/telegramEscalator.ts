import { serverEnv } from '@/env/server'
import { sendMessage as telegramSendMessage } from '@/services/telegram'
import { logger } from '@/utils/logger'
import type { EscalatorPort } from '../ports'

// Telegram's default sendMessage parse_mode is HTML. Raw error text frequently
// contains '<', '>', '&' (e.g. "Cannot read properties of <undefined>"), which
// the HTML parser rejects with "Bad Request: can't parse entities" — making
// the loud alert silently fail. Escape to keep the spec's "never silent"
// contract intact.
const escapeHTML = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/**
 * Production escalator: fans the `failed-write-also-failed` alert out to
 * every configured Telegram chat. Owns its own HTML escaping so the
 * pipeline core never touches presentation concerns.
 */
export const telegramEscalator: EscalatorPort = {
  async alert({ logId, message, writeError }) {
    const chatIds = serverEnv.telegramChatIds
    if (chatIds.length === 0) return

    const text = [
      '🚨 Image pipeline write-also-failed',
      `logId: ${logId}`,
      `cause: ${escapeHTML(message)}`,
      `writeError: ${escapeHTML(writeError)}`,
    ].join('\n')

    await Promise.all(
      chatIds.map(async (chatId) => {
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
  },
}
