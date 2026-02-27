import { createFileRoute } from '@tanstack/react-router'
import { runImageGenerationScript } from '@/services/script'
import { methodNotAllowed, ok } from '@/utils/http'

export const Route = createFileRoute('/api/script')({
  server: {
    handlers: {
      GET: async () => methodNotAllowed('POST'),
      POST: async () => {
        const response = await runImageGenerationScript()
        return ok(response)
      },
    },
  },
})
