import { createFileRoute } from '@tanstack/react-router'
import { getLog } from '@/services/log'
import { notifier } from '@/services/notifier'
import { defineHandlers } from '@/services/route/defineHandlers'
import type { TelegramIdResponse } from '@/types/api/telegram-id'
import { ok } from '@/utils/http'
import { logger } from '@/utils/logger'
import { createFriendly, type FriendlyMessages } from '../log/_friendly'

const messages: FriendlyMessages = {
  AI_UNAVAILABLE:
    'Our mystical AI assistant is temporarily unavailable. Please try again in a moment.',
  AI_UNEXPECTED_RESPONSE:
    'Our mystical AI assistant returned an unexpected response. Please try again.',
  CONNECTION_ISSUE: 'Connection issue detected. Please check your internet and try again.',
  REQUEST_TIMEOUT: 'The request took too long. Please try again.',
  GENERIC_FALLBACK: 'Telegram dispatch failed',
  DB_UNAVAILABLE: 'Telegram dispatch failed',
}

// The pre-refactor catch returned `error.message` verbatim — preserve that
// exact shape by forwarding the thrown value's message through the
// reporter's `build`. The friendly-copy classifier still runs, but the
// route surface remains the raw cause string for backward compatibility.
const reporter = createFriendly<Response>({
  messages,
  build: (text) => ok<TelegramIdResponse>({ success: false, error: text }),
  onError: (error) => logger.error('Telegram dispatch failed:', error),
})

export const Route = createFileRoute('/api/telegram/$id')({
  server: {
    handlers: defineHandlers(
      {
        POST: {
          reporter,
          handler: async (_input, { params }) => {
            const id = Number(params.id)

            if (Number.isNaN(id)) {
              return {
                data: {
                  success: false as const,
                  error: 'Invalid event ID',
                } satisfies TelegramIdResponse,
              }
            }

            const event = await getLog(id)
            if (!event) {
              return {
                data: {
                  success: false as const,
                  error: 'Event not found',
                } satisfies TelegramIdResponse,
              }
            }

            const outcome = await notifier.notify(event)
            if (outcome.delivered) {
              return {
                data: {
                  success: true as const,
                  messageId: outcome.messageId ?? 0,
                } satisfies TelegramIdResponse,
              }
            }

            const error =
              outcome.reachedChats === 0 ? 'Telegram fan-out failed' : 'Telegram fan-out partial'
            return {
              data: {
                success: false as const,
                error,
                partial: {
                  reachedChats: outcome.reachedChats,
                  totalChats: outcome.totalChats,
                  failedPhotoChats: outcome.failedPhotoChats,
                },
              } satisfies TelegramIdResponse,
            }
          },
        },
      },
      { route: '/api/telegram/$id' },
    ),
  },
})
