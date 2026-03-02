import { createFileRoute } from '@tanstack/react-router'
import { getLog } from '@/services/log'
import { sendEventNotification } from '@/services/notification'
import type { TelegramIdResponse } from '@/types/api/telegram-id'
import { ok, StatusCode } from '@/utils/http'
import { applyRateLimit } from '@/utils/rate-limit'
import { time } from '@/utils/time'

export const Route = createFileRoute('/api/telegram/$id')({
  server: {
    handlers: {
      POST: async ({ params, request }) => {
        try {
          const rateLimitResult = applyRateLimit(request, {
            namespace: 'api:telegram',
            maxRequests: 5,
            windowMs: time({ minutes: 1 }),
          })

          if (!rateLimitResult.allowed) {
            return ok<TelegramIdResponse>(
              {
                success: false,
                error: `Too many requests. Retry in ~${rateLimitResult.retryAfterSeconds}s.`,
              },
              { status: StatusCode.TooManyRequests },
            )
          }

          const id = Number(params.id)

          if (Number.isNaN(id)) {
            return ok<TelegramIdResponse>(
              {
                success: false,
                error: 'Invalid event ID',
              },
              { status: StatusCode.BadRequest },
            )
          }

          const event = await getLog(id)
          if (!event) {
            return ok<TelegramIdResponse>(
              {
                success: false,
                error: 'Event not found',
              },
              { status: StatusCode.NotFound },
            )
          }

          const telegramResult = await sendEventNotification(event)
          if (!telegramResult.success) {
            return ok<TelegramIdResponse>(
              {
                success: false,
                error: telegramResult.error || 'Unknown error',
              },
              { status: StatusCode.BadGateway },
            )
          }

          return ok<TelegramIdResponse>({
            success: true,
            messageId: telegramResult.messageId || 0,
          })
        } catch (error) {
          return ok<TelegramIdResponse>(
            {
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error',
            },
            { status: StatusCode.InternalServerError },
          )
        }
      },
    },
  },
})
