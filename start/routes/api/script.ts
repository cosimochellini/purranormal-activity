import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/api/script')({
  server: {
    handlers: {
      GET: async () => new Response('Categories migration completed', { status: 200 }),
    },
  },
})
