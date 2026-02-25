import { createFileRoute } from '@tanstack/react-router'
import { runImageGenerationScript } from '@/services/script'
import { ok } from '@/utils/http'

export const Route = createFileRoute('/api/script')({
  server: {
    handlers: {
      GET: async () => {
        const response = await runImageGenerationScript()
        return ok(response)
      },
      POST: async () => {
        const response = await runImageGenerationScript()
        return ok(response)
      },
    },
  },
})
