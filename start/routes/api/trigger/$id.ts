import { createFileRoute } from '@tanstack/react-router'
import { setLogError } from '@/services/log'
import { generateLogImage } from '@/services/trigger'
import { ok } from '@/utils/http'
import { logger } from '@/utils/logger'

export const Route = createFileRoute('/api/trigger/$id')({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        let logId: number | undefined
        try {
          const url = new URL(request.url)
          const rawId = params.id ?? url.searchParams.get('id')
          logId = Number(rawId)

          await generateLogImage(logId)

          return ok({ success: true })
        } catch (error) {
          logger.error('Failed to generate image:', error)
          await setLogError(logId, error)

          return ok({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          })
        }
      },
    },
  },
})
