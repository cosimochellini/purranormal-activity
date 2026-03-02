import type { LogWithCategories } from '@/db/schema'
import { generateTelegramMessage } from '@/services/ai'
import { sendMessage, sendPhoto } from '@/services/telegram'
import type { SendEventNotificationResult } from '@/services/telegram/types'
import { logger } from '@/utils/logger'
import { publicImage } from '@/utils/public-image'

/**
 * Formats and sends a paranormal event notification
 */
export async function sendEventNotification(
  event: LogWithCategories,
): Promise<SendEventNotificationResult> {
  try {
    const text = await generateTelegramMessage(event)

    const result = await sendMessage({
      text,
      options: {
        parseMode: 'HTML',
      },
    })

    if (!result.success) {
      logger.error('Failed to send message:', { error: result.error, eventId: event.id, text })
      return {
        success: false,
        error: result.error || 'Failed to send message',
      }
    }
    const imageURL = publicImage(event.id)

    if (!imageURL) {
      return {
        success: false,
        error: 'Missing public image base URL',
      }
    }

    const photoResult = await sendPhoto({
      photo: imageURL,
      options: {
        parseMode: 'MarkdownV2',
      },
    })

    if (!photoResult.success) {
      logger.error('Failed to send photo:', { error: photoResult.error, eventId: event.id })
      return {
        success: false,
        error: result.error,
      }
    }

    return {
      success: true,
      messageId: result.messageIds?.[result.messageIds.length - 1] || 0,
    }
  } catch (error) {
    logger.error('Failed to format event notification:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
