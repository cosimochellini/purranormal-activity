import { createFileRoute } from '@tanstack/react-router'
import { eq } from 'drizzle-orm'
import { UPLOAD_LIMITS } from '@/constants'
import { LogStatus } from '@/data/enum/logStatus'
import { log } from '@/db/schema'
import { db } from '@/drizzle'
import { serverEnv } from '@/env/server'
import { imageStore } from '@/services/imageStore/r2.server'
import type { UploadIdResponse } from '@/types/api/upload-id'
import { badRequest, ok } from '@/utils/http'

// This route is intentionally OFF the `defineHandlers` envelope:
//   - It reads `multipart/form-data` (not JSON), so the envelope's body
//     slot is not applicable.
//   - It returns `400` (`badRequest`) on every failure path, each with its
//     own `error` copy (`'File is required'`, `'Invalid log ID'`,
//     `'Invalid secret'`, `'File must be an image'`, `'File is too large…'`,
//     `'Log not found'`, and the verbatim catch-path
//     `Failed to upload file ${error}`) — the edit form shows that copy as is.
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
          const secret = formData.get('secret')
          const logId = Number(params.id)

          if (!file) return badRequest('File is required')
          if (Number.isNaN(logId)) return badRequest('Invalid log ID')

          // Gated because this handler now also flips the row to
          // `ImageGenerated`, which both publishes the bytes to every viewer
          // (`EventImage` only renders the R2 object once the status leaves
          // `Created`/`Error`) and takes the row out of the cron sweeper's
          // `status = 'Created'` scan — so an unauthenticated caller who knows a
          // log id, which is right there in the public URL, could pin arbitrary
          // bytes as a cover with no automatic recovery.
          if (typeof secret !== 'string' || secret.toLowerCase() !== serverEnv.secret) {
            return badRequest('Invalid secret')
          }

          // Any image format is accepted: the object is still stored as
          // `cover.webp`, and browsers sniff the real format in `<img>`.
          if (!file.type.startsWith('image/')) return badRequest('File must be an image')
          if (file.size > UPLOAD_LIMITS.MAX_BYTES) {
            return badRequest('File is too large (max 5 MB)')
          }

          // Checked before the R2 write: otherwise an unknown id leaves an
          // orphan `<id>/cover.webp` behind and the status update below
          // silently matches zero rows.
          const row = await db.select({ id: log.id }).from(log).where(eq(log.id, logId)).get()
          if (!row) return badRequest('Log not found')

          const bytes = new Uint8Array(await file.arrayBuffer())
          await imageStore.put(logId, bytes)

          // The row now has a cover, so mark it done. Without this it stays
          // `Created`, and the cron sweeper would eventually enqueue it,
          // overwrite the hand-uploaded cover with a generated one, and then
          // mark it `Error`.
          await db
            .update(log)
            .set({
              status: LogStatus.ImageGenerated,
              error: null,
              attempts: 0,
              updatedAt: Date.now(),
            })
            .where(eq(log.id, logId))

          return ok<UploadIdResponse>({ success: true }, { invalidate: ['logs', `log:${logId}`] })
        } catch (error) {
          return badRequest(`Failed to upload file ${error}`)
        }
      },
    },
  },
})
