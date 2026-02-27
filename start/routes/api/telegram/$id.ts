import { createFileRoute } from '@tanstack/react-router'
import { getLog } from '@/services/log'
import { sendEventNotification } from '@/services/notification'
import type { TelegramIdResponse } from '@/types/api/telegram-id'
import { ok } from '@/utils/http'

export const Route = createFileRoute('/api/telegram/$id')({
  server: {
    handlers: {
      POST: async ({ params }) => {
        try {
          const id = Number(params.id)

          if (Number.isNaN(id)) {
            return ok<TelegramIdResponse>({
              success: false,
              error: 'Invalid event ID',
            })
          }

          const event = await getLog(id)
          if (!event) {
            return ok<TelegramIdResponse>({
              success: false,
              error: 'Event not found',
            })
          }

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
      },
    },
  },
})
