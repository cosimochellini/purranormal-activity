import { getRequiredEnv } from './required'

export const TELEGRAM_BOT_API_KEY = getRequiredEnv('TELEGRAM_BOT_API_KEY')

const telegramChatIds = getRequiredEnv('TELEGRAM_BOT_CHAT_IDS')
export const TELEGRAM_BOT_CHAT_IDS = telegramChatIds
  .split(',')
  .map((chatId) => chatId.trim())
  .filter(Boolean)
