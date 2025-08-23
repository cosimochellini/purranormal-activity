import { getLog } from '@/services/log'
import { sendEventNotification } from '@/services/notification'
import type { PageProps } from '@/types/next'
import { ok } from '@/utils/http'

export const runtime = 'edge'
interface Params {
  id: string
}
export type Response =
  | {
      success: true
      messageId: number
    }
  | {
      success: false
      error: string
    }

export async function POST(_: Request, { params }: PageProps<Params>) {
  try {
    const { id: idParam } = await params
    const id = Number(idParam)

    if (Number.isNaN(id)) {
      return ok<Response>({
        success: false,
        error: 'Invalid event ID',
      })
    }

    // Fetch the event
    const event = await getLog(id)
    if (!event) {
      return ok<Response>({
        success: false,
        error: 'Event not found',
      })
    }

    // Send notification using the telegram service
    const telegramResult = await sendEventNotification(event)

    if (!telegramResult.success) {
      return ok<Response>({
        success: false,
        error: telegramResult.error || 'Unknown error',
      })
    }

    return ok<Response>({
      success: true,
      messageId: telegramResult.messageId || 0,
    })
  } catch (error) {
    return ok<Response>({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}
