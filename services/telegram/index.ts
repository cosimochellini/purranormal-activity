import { TELEGRAM_BOT_API_KEY, TELEGRAM_BOT_CHAT_IDS } from '@/env/telegram'
import { fetcher } from '@/utils/fetch'
import { logger } from '../../utils/logger'
import type {
  SendMessageBody,
  SendMessageInput,
  SendMessageResult,
  SendPhotoBody,
  SendPhotoInput,
  SendPhotoResult,
  TelegramApiResponse,
} from './types'

const sendMessageAPI = fetcher<TelegramApiResponse, never, SendMessageBody>(
  `https://api.telegram.org/bot${TELEGRAM_BOT_API_KEY}/sendMessage`,
  'POST',
)

const sendPhotoAPI = fetcher<TelegramApiResponse, never, SendPhotoBody>(
  `https://api.telegram.org/bot${TELEGRAM_BOT_API_KEY}/sendPhoto`,
  'POST',
)

/**
 * Generic function to send messages via Telegram Bot API
 */
export async function sendMessage(input: SendMessageInput): Promise<SendMessageResult> {
  try {
    const { text, options = {} } = input
    const {
      parseMode = 'MarkdownV2',
      disableWebPagePreview = true,
      silent = false,
      chatIds = TELEGRAM_BOT_CHAT_IDS,
    } = options

    const messageIds: number[] = []

    for (const chatId of chatIds) {
      try {
        const responseData = await sendMessageAPI({
          body: {
            chat_id: chatId.trim(),
            text,
            parse_mode: parseMode,
            disable_web_page_preview: disableWebPagePreview,
            disable_notification: silent,
          },
        })

        if (!responseData.ok) {
          logger.error(`Telegram API error for chat ${chatId}:`, responseData.description)
          continue
        }

        const messageId = responseData.result?.message_id || 0
        messageIds.push(messageId)
      } catch (error) {
        // Continue to next chat on error
      }
    }

    return {
      success: messageIds.length > 0,
      messageIds: messageIds.length > 0 ? messageIds : undefined,
      error: messageIds.length === 0 ? 'Failed to send message to all chat IDs' : undefined,
    }
  } catch (error) {
    logger.error('Failed to send Telegram message:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Generic function to send photos via Telegram Bot API
 */
export async function sendPhoto(input: SendPhotoInput): Promise<SendPhotoResult> {
  try {
    const { photo, options = {} } = input
    const {
      businessConnectionId,
      messageThreadId,
      directMessagesTopicId,
      caption,
      parseMode = 'MarkdownV2',
      captionEntities,
      showCaptionAboveMedia,
      hasSpoiler,
      silent = false,
      protectContent,
      allowPaidBroadcast,
      messageEffectId,
      suggestedPostParameters,
      replyParameters,
      replyMarkup,
      chatIds = TELEGRAM_BOT_CHAT_IDS,
      // Backward compatibility
      replyToMessageId,
    } = options

    const messageIds: number[] = []

    for (const chatId of chatIds) {
      try {
        const responseData = await sendPhotoAPI({
          body: {
            business_connection_id: businessConnectionId,
            chat_id: chatId.trim(),
            message_thread_id: messageThreadId,
            direct_messages_topic_id: directMessagesTopicId,
            photo,
            caption,
            parse_mode: parseMode,
            caption_entities: captionEntities,
            show_caption_above_media: showCaptionAboveMedia,
            has_spoiler: hasSpoiler,
            disable_notification: silent,
            protect_content: protectContent,
            allow_paid_broadcast: allowPaidBroadcast,
            message_effect_id: messageEffectId,
            suggested_post_parameters: suggestedPostParameters,
            reply_parameters: replyParameters,
            reply_markup: replyMarkup,
            // Backward compatibility: use replyToMessageId if replyParameters is not provided
            reply_to_message_id: replyParameters ? undefined : replyToMessageId,
          },
        })

        if (!responseData.ok) {
          logger.error(`Telegram API error for chat ${chatId}:`, responseData.description)
          continue
        }

        const messageId = responseData.result?.message_id || 0
        messageIds.push(messageId)
      } catch (error) {
        logger.error(`Telegram API error for chat ${chatId}:`, error)
        // Continue to next chat on error
      }
    }

    return {
      success: messageIds.length > 0,
      messageIds: messageIds.length > 0 ? messageIds : undefined,
      error: messageIds.length === 0 ? 'Failed to send photo to all chat IDs' : undefined,
    }
  } catch (error) {
    logger.error('Failed to send Telegram photo:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
