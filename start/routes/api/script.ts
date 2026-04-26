import { createFileRoute } from '@tanstack/react-router'
import { runImageGenerationScript } from '@/services/script'
import { methodNotAllowed, ok } from '@/utils/http'

export const Route = createFileRoute('/api/script')({
  server: {
    handlers: {
      GET: async () => methodNotAllowed('POST'),
      POST: async () => {
        const response = await runImageGenerationScript()
        // Tag list-affecting routes only when at least one row was mutated.
        // Today the caller is typically cron (no client router → no-op), but
        // an admin UI invocation will pick this up automatically.
        return ok(response, response.processed > 0 ? { invalidate: ['logs'] } : undefined)
      },
    },
  },
})
