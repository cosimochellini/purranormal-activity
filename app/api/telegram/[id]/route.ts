import { getLog } from '@/services/log'
import { sendEventNotification } from '@/services/notification'
import type { TelegramIdResponse } from '@/types/api/telegram-id'
import { ok } from '@/utils/http'

export const runtime = 'edge'

interface Params {
  id: string
}

interface RouteParamsContext {
  params: Promise<Params>
}

export async function POST(_: Request, { params }: RouteParamsContext) {
  try {
    const { id: idParam } = await params
    const id = Number(idParam)

    if (Number.isNaN(id)) {
      return ok<TelegramIdResponse>({
        success: false,
        error: 'Invalid event ID',
      })
    }

    // Fetch the event
    const event = await getLog(id)
    if (!event) {
      return ok<TelegramIdResponse>({
        success: false,
        error: 'Event not found',
      })
    }

    // Send notification using the telegram service
    const telegramResult = await sendEventNotification(event)

    if (!telegramResult.success) {
      return ok<TelegramIdResponse>({
        success: false,
        error: telegramResult.error || 'Unknown error',
      })
    }

    return ok<TelegramIdResponse>({
      success: true,
      messageId: telegramResult.messageId || 0,
    })
  } catch (error) {
    return ok<TelegramIdResponse>({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}
