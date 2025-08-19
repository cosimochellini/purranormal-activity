/* eslint-disable node/prefer-global/process */
export const TELEGRAM_BOT_API_KEY = process.env.TELEGRAM_BOT_API_KEY as string
export const TELEGRAM_BOT_CHAT_IDS = (process.env.TELEGRAM_BOT_CHAT_IDS as string).split(',')
