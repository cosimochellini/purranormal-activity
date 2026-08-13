import { createFileRoute } from '@tanstack/react-router'
import { imageStore } from '@/services/imageStore/r2.server'
import type { UploadIdResponse } from '@/types/api/upload-id'
import { badRequest, ok } from '@/utils/http'

// This route is intentionally OFF the `defineHandlers` envelope:
//   - It reads `multipart/form-data` (not JSON), so the envelope's body
//     slot is not applicable.
//   - It returns `400` (`badRequest`) on every failure path, with three
//     distinct copies — `'File is required'` / `'Invalid log ID'` / a
//     verbatim catch-path `Failed to upload file ${error}` — preserving
//     the pre-refactor surface byte-for-byte.
//
// Adopting the envelope for this route would require either collapsing the
// granular copies (which broke the surface in PR #18) or extending the
// envelope's API with a hand-rolled non-200 escape hatch. The simpler
// pattern is to keep this route hand-built; the envelope's value-add
// (validation merge, scoped logger, friendly classifier) doesn't apply
// here anyway.
export const Route = createFileRoute('/api/upload/$id')({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        try {
          const formData = await request.formData()
          const file = formData.get('file') as File | null
          const logId = Number(params.id)

          if (!file) return badRequest('File is required')
          if (Number.isNaN(logId)) return badRequest('Invalid log ID')

          const bytes = new Uint8Array(await file.arrayBuffer())
          await imageStore.put(logId, bytes)

          return ok<UploadIdResponse>({ success: true })
        } catch (error) {
          return badRequest(`Failed to upload file ${error}`)
        }
      },
    },
  },
})
