import { createFileRoute } from '@tanstack/react-router'
import { invalidatePublicContent } from '@/services/content'
import { setLogError } from '@/services/log'
import { generateLogImage } from '@/services/trigger'
import { ok } from '@/utils/http'
import { logger } from '@/utils/logger'

export const Route = createFileRoute('/api/trigger/$id')({
  server: {
    handlers: {
      POST: async ({ params }) => {
        let logId: number | undefined
        try {
          logId = Number(params.id)

          if (Number.isNaN(logId)) {
            return ok({
              success: false,
              error: 'Invalid log id',
            })
          }

          await generateLogImage(logId)
          await invalidatePublicContent()

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
