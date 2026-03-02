import { createFileRoute } from '@tanstack/react-router'
import { invalidatePublicContent } from '@/services/content'
import { setLogError } from '@/services/log'
import { triggerLogImageIfPending } from '@/services/trigger'
import type { TriggerIdResponse } from '@/types/api/trigger-id'
import { ok, StatusCode } from '@/utils/http'
import { logger } from '@/utils/logger'
import { applyRateLimit } from '@/utils/rate-limit'
import { time } from '@/utils/time'

export const Route = createFileRoute('/api/trigger/$id')({
  server: {
    handlers: {
      POST: async ({ params, request }) => {
        let logId: number | undefined
        try {
          const rateLimitResult = applyRateLimit(request, {
            namespace: 'api:trigger-image',
            maxRequests: 20,
            windowMs: time({ minutes: 1 }),
          })

          if (!rateLimitResult.allowed) {
            return ok<TriggerIdResponse>(
              {
                success: false,
                error: `Too many requests. Retry in ~${rateLimitResult.retryAfterSeconds}s.`,
              },
              { status: StatusCode.TooManyRequests },
            )
          }

          logId = Number(params.id)

          if (Number.isNaN(logId)) {
            return ok<TriggerIdResponse>(
              {
                success: false,
                error: 'Invalid log id',
              },
              { status: StatusCode.BadRequest },
            )
          }

          const triggered = await triggerLogImageIfPending(logId)

          if (!triggered) {
            return ok<TriggerIdResponse>(
              {
                success: false,
                error: 'Image generation is not needed for this log.',
              },
              { status: StatusCode.Conflict },
            )
          }

          await invalidatePublicContent()

          return ok<TriggerIdResponse>({ success: true })
        } catch (error) {
          logger.error('Failed to generate image:', error)
          await setLogError(logId, error)

          return ok<TriggerIdResponse>(
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
