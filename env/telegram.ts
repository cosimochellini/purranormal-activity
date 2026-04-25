/* eslint-disable node/prefer-global/process */
import { logger } from '../utils/logger'

const rawApiKey = process.env.TELEGRAM_BOT_API_KEY
if (!rawApiKey) {
  logger.warn('[env/telegram] TELEGRAM_BOT_API_KEY is not set; Telegram notifications will fail.')
}
export const TELEGRAM_BOT_API_KEY = (rawApiKey ?? '') as string

const rawChatIds = process.env.TELEGRAM_BOT_CHAT_IDS
if (!rawChatIds) {
  logger.warn('[env/telegram] TELEGRAM_BOT_CHAT_IDS is not set; falling back to an empty list.')
}
export const TELEGRAM_BOT_CHAT_IDS = (rawChatIds ?? '')
  .split(',')
  .map((id) => id.trim())
  .filter(Boolean)
