import { createFileRoute } from '@tanstack/react-router'
import { runImageGenerationScript } from '@/services/script'
import { ok } from '@/utils/http'

export const Route = createFileRoute('/api/trigger/images')({
  server: {
    handlers: {
      POST: async () => {
        const response = await runImageGenerationScript()
        return ok(response)
      },
    },
  },
})
