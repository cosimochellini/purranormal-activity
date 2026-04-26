import type { LogWithCategories } from '@/db/schema'
import { notifier } from '@/services/notifier'
import type { SendEventNotificationResult } from '@/services/telegram/types'

/**
 * @deprecated Transitional shim — call `notifier.notify(event)` directly. This
 * file is removed once the route handler is cut over to the Notifier.
 */
export async function sendEventNotification(
  event: LogWithCategories,
): Promise<SendEventNotificationResult> {
  try {
    const outcome = await notifier.notify(event)
    if (outcome.delivered) {
      return { success: true, messageId: outcome.messageId ?? 0 }
    }
    const error =
      outcome.reachedChats === 0 ? 'Telegram fan-out failed' : 'Telegram fan-out partial'
    return { success: false, error }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
