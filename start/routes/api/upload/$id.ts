/* eslint-disable node/prefer-global/buffer */
import { createFileRoute } from '@tanstack/react-router'
import { defineHandlers } from '@/services/route/defineHandlers'
import type { UploadIdResponse } from '@/types/api/upload-id'
import { uploadToR2 } from '@/utils/cloudflare'
import { badRequest } from '@/utils/http'
import { logger } from '@/utils/logger'
import { createFriendly, type FriendlyMessages } from '../log/_friendly'

const messages: FriendlyMessages = {
  AI_UNAVAILABLE:
    'Our mystical AI assistant is temporarily unavailable. Please try again in a moment.',
  AI_UNEXPECTED_RESPONSE:
    'Our mystical AI assistant returned an unexpected response. Please try again.',
  CONNECTION_ISSUE: 'Connection issue detected. Please check your internet and try again.',
  REQUEST_TIMEOUT: 'The request took too long. Please try again.',
  GENERIC_FALLBACK: 'Failed to upload file',
  DB_UNAVAILABLE: 'Failed to upload file',
}

// Upload is the only route that:
//   - Reads `multipart/form-data` (not JSON), so the envelope's body schema is
//     intentionally unused — the handler reads `ctx.request.formData()`.
//   - Returns 400 (`badRequest`) on both validation and thrown failures,
//     instead of `ok(...)` with a discriminated payload.
//
// The envelope's body/query/params slot machinery is bypassed here; the
// envelope is still used for its scoped logger + reporter dispatch (so a
// thrown error still routes through `createFriendly`'s catch path and out
// as a 400, matching the pre-refactor behaviour).
const reporter = createFriendly<Response>({
  messages,
  build: (text) => badRequest(text),
  onError: (error) => logger.error('Failed to upload file:', error),
})

export const Route = createFileRoute('/api/upload/$id')({
  server: {
    handlers: defineHandlers(
      {
        POST: {
          reporter,
          handler: async (_input, { request, params }) => {
            const formData = await request.formData()
            const file = formData.get('file') as File
            const logId = Number(params.id)

            if (!file) {
              // Hand-rolled non-2xx response — envelope only owns the 200
              // success path. Throw with a friendly-mappable message so the
              // reporter's `build(text)` produces the matching 400 payload.
              throw new Error('Failed to upload file: file is required')
            }
            if (Number.isNaN(logId)) {
              throw new Error('Failed to upload file: invalid log ID')
            }

            const buffer = Buffer.from(await file.arrayBuffer())
            const result = await uploadToR2(buffer, logId)

            const data: UploadIdResponse = {
              success: true,
              result: {
                etag: result.ETag ?? null,
                versionId: result.VersionId ?? null,
              },
            }
            return { data }
          },
        },
      },
      { route: '/api/upload/$id' },
    ),
  },
})
