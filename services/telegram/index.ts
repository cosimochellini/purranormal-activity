import { TELEGRAM_BOT_API_KEY } from '@/env/telegram'
import { fetcher } from '@/utils/fetch'
import { logger } from '../../utils/logger'
import type {
  ChatResult,
  SendMessageBody,
  SendMessageOptions,
  SendPhotoBody,
  SendPhotoOptions,
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
 * Send a single Telegram message to a single chat.
 *
 * Multi-chat fan-out lives in `services/notifier` — this module
 * intentionally exposes only single-chat primitives so future channels
 * (Slack, email, ...) can re-use the same fan-out infrastructure.
 */
export async function sendMessage(
  chatId: string,
  text: string,
  options: SendMessageOptions = {},
): Promise<ChatResult> {
  const { parseMode = 'HTML', disableWebPagePreview = true, silent = false } = options

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
      return {
        success: false,
        error: responseData.description ?? 'Telegram API rejected the message',
      }
    }

    return {
      success: true,
      messageId: responseData.result?.message_id,
    }
  } catch (error) {
    logger.error(`Telegram sendMessage failed for chat ${chatId}:`, error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Send a single Telegram photo to a single chat.
 */
export async function sendPhoto(
  chatId: string,
  photoUrl: string,
  options: SendPhotoOptions = {},
): Promise<ChatResult> {
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
    replyToMessageId,
  } = options

  try {
    const responseData = await sendPhotoAPI({
      body: {
        business_connection_id: businessConnectionId,
        chat_id: chatId.trim(),
        message_thread_id: messageThreadId,
        direct_messages_topic_id: directMessagesTopicId,
        photo: photoUrl,
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
        reply_to_message_id: replyParameters ? undefined : replyToMessageId,
      },
    })

    if (!responseData.ok) {
      logger.error(`Telegram API error for chat ${chatId}:`, responseData.description)
      return {
        success: false,
        error: responseData.description ?? 'Telegram API rejected the photo',
      }
    }

    return {
      success: true,
      messageId: responseData.result?.message_id,
    }
  } catch (error) {
    logger.error(`Telegram sendPhoto failed for chat ${chatId}:`, error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
