import { createFileRoute } from '@tanstack/react-router'
import { runImageGenerationScript } from '@/services/script'
import { methodNotAllowed, ok, StatusCode } from '@/utils/http'
import { applyRateLimit } from '@/utils/rate-limit'
import { isSecretValid, readSecretFromRequest } from '@/utils/security'
import { time } from '@/utils/time'

export const Route = createFileRoute('/api/script')({
  server: {
    handlers: {
      GET: async () => methodNotAllowed('POST'),
      POST: async ({ request }) => {
        const rateLimitResult = applyRateLimit(request, {
          namespace: 'api:script',
          maxRequests: 3,
          windowMs: time({ minutes: 1 }),
        })

        if (!rateLimitResult.allowed) {
          return ok(
            {
              success: false,
              processed: 0,
              error: `Too many requests. Retry in ~${rateLimitResult.retryAfterSeconds}s.`,
            },
            { status: StatusCode.TooManyRequests },
          )
        }

        const providedSecret = readSecretFromRequest(request)

        if (!isSecretValid(providedSecret)) {
          return ok(
            {
              success: false,
              processed: 0,
              error: 'Unauthorized',
            },
            { status: StatusCode.Unauthorized },
          )
        }

        const response = await runImageGenerationScript()
        return ok(response, {
          status: response.success ? StatusCode.Ok : StatusCode.InternalServerError,
        })
      },
    },
  },
})
