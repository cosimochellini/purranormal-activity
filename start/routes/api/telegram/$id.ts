import { createFileRoute } from '@tanstack/react-router'
import { getLog } from '@/services/log'
import { notifier } from '@/services/notifier'
import type { TelegramIdResponse } from '@/types/api/telegram-id'
import { ok } from '@/utils/http'
import { logger } from '@/utils/logger'

// This route is intentionally OFF the `defineHandlers` envelope's
// reporter-guard catch path. The pre-refactor contract was: forward the
// thrown error's `message` verbatim — the friendly-copy classifier in
// `_friendly.ts` would otherwise rewrite libsql / fetch / OpenAI surfaces
// into static user-facing copy, breaking the byte-for-byte response shape.
//
// Telegram dispatch is a backend-driven, programmatic endpoint where the
// raw cause string is the useful debugging surface. We catch in-handler,
// forward `error.message`, and skip the envelope entirely.
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
          logger.error('Telegram dispatch failed:', error)
          return ok<TelegramIdResponse>({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          })
        }
      },
    },
  },
})
