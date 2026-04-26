import { createFileRoute } from '@tanstack/react-router'
import { getLog } from '@/services/log'
import { notifier } from '@/services/notifier'
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

          const outcome = await notifier.notify(event)
          if (outcome.delivered) {
            return ok<TelegramIdResponse>({
              success: true,
              messageId: outcome.messageId ?? 0,
            })
          }

          const error =
            outcome.reachedChats === 0 ? 'Telegram fan-out failed' : 'Telegram fan-out partial'
          return ok<TelegramIdResponse>({
            success: false,
            error,
            partial: {
              reachedChats: outcome.reachedChats,
              totalChats: outcome.totalChats,
              failedPhotoChats: outcome.failedPhotoChats,
            },
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
