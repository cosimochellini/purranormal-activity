import type { LogWithCategories } from '@/db/schema'
import { TELEGRAM_BOT_CHAT_IDS } from '@/env/telegram'
import { generateTelegramMessage } from '@/services/ai'
import {
  sendMessage as telegramSendMessage,
  sendPhoto as telegramSendPhoto,
} from '@/services/telegram'
import type { ChatResult } from '@/services/telegram/types'
import { logger as defaultLogger, type Logger } from '@/utils/logger'
import { publicImage } from '@/utils/public-image'

export interface NotifyOutcome {
  /** True iff every configured chat received both the text and the photo. */
  delivered: boolean
  /** Number of chats whose text message succeeded. */
  reachedChats: number
  /** Configured fan-out size. */
  totalChats: number
  /** Chats whose text succeeded but photo failed; safe target for a retry. */
  failedPhotoChats: string[]
  /** Best-effort: a successful text message id (last one if multiple chats). */
  messageId?: number
}

export interface Notifier {
  notify(event: LogWithCategories): Promise<NotifyOutcome>
}

export interface NotifierDeps {
  chatIds: string[]
  sendMessage: (chatId: string, body: string) => Promise<ChatResult>
  sendPhoto: (chatId: string, photoUrl: string) => Promise<ChatResult>
  composeMessage: (event: LogWithCategories) => Promise<string>
  resolveImageUrl: (id: number) => string
  logger: Logger
}

interface ChatRollup {
  chatId: string
  textOk: boolean
  photoOk: boolean
  messageId?: number
}

const emptyOutcome = (): NotifyOutcome => ({
  delivered: false,
  reachedChats: 0,
  totalChats: 0,
  failedPhotoChats: [],
  messageId: undefined,
})

export const createNotifier = (overrides: Partial<NotifierDeps> = {}): Notifier => {
  const deps: NotifierDeps = {
    chatIds: overrides.chatIds ?? TELEGRAM_BOT_CHAT_IDS,
    sendMessage: overrides.sendMessage ?? ((chatId, body) => telegramSendMessage(chatId, body)),
    sendPhoto: overrides.sendPhoto ?? ((chatId, url) => telegramSendPhoto(chatId, url)),
    composeMessage: overrides.composeMessage ?? generateTelegramMessage,
    resolveImageUrl: overrides.resolveImageUrl ?? publicImage,
    logger: overrides.logger ?? defaultLogger,
  }

  const oneChat = async (
    chatId: string,
    text: string,
    photoUrl: string,
    eventId: number,
  ): Promise<ChatRollup> => {
    try {
      const txt = await deps.sendMessage(chatId, text)
      if (!txt.success) {
        deps.logger.error('telegram text failed', {
          chatId,
          error: txt.error,
          eventId,
        })
        return { chatId, textOk: false, photoOk: false, messageId: undefined }
      }

      const pho = await deps.sendPhoto(chatId, photoUrl)
      if (!pho.success) {
        deps.logger.error('telegram photo failed', {
          chatId,
          error: pho.error,
          eventId,
        })
      }
      return {
        chatId,
        textOk: true,
        photoOk: pho.success,
        messageId: txt.messageId,
      }
    } catch (error) {
      deps.logger.error('telegram chat threw', { chatId, error, eventId })
      return { chatId, textOk: false, photoOk: false, messageId: undefined }
    }
  }

  return {
    async notify(event) {
      if (deps.chatIds.length === 0) {
        deps.logger.warn('telegram fan-out skipped: no chatIds configured', {
          eventId: event.id,
        })
        return emptyOutcome()
      }

      const text = await deps.composeMessage(event)
      const photoUrl = deps.resolveImageUrl(event.id)

      const results = await Promise.all(
        deps.chatIds.map((chatId) => oneChat(chatId, text, photoUrl, event.id)),
      )

      const reachedChats = results.filter((r) => r.textOk).length
      const failedPhotoChats = results.filter((r) => r.textOk && !r.photoOk).map((r) => r.chatId)
      const totalChats = deps.chatIds.length
      const delivered = reachedChats === totalChats && failedPhotoChats.length === 0

      const lastSuccessfulMessageId = results
        .filter((r) => r.textOk && typeof r.messageId === 'number')
        .map((r) => r.messageId as number)
        .pop()

      if (!delivered) {
        deps.logger.warn('telegram fan-out partial', {
          eventId: event.id,
          reachedChats,
          totalChats,
          failedPhotoChats,
        })
      }

      return {
        delivered,
        reachedChats,
        totalChats,
        failedPhotoChats,
        messageId: lastSuccessfulMessageId,
      }
    },
  }
}

/**
 * Default singleton wired to the production deps.
 */
export const notifier: Notifier = createNotifier()
