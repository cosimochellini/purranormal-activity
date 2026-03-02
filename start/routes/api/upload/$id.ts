/* eslint-disable node/prefer-global/buffer */
import { createFileRoute } from '@tanstack/react-router'
import type { UploadIdResponse } from '@/types/api/upload-id'
import { uploadToR2 } from '@/utils/cloudflare'
import { ok, StatusCode } from '@/utils/http'
import { applyRateLimit } from '@/utils/rate-limit'
import { isSecretValid, readSecretFromRequest } from '@/utils/security'
import { time } from '@/utils/time'

const MAX_FILE_SIZE_BYTES = 8 * 1024 * 1024
const SUPPORTED_IMAGE_TYPES = new Set(['image/webp', 'image/jpeg', 'image/jpg', 'image/png'])

export const Route = createFileRoute('/api/upload/$id')({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        try {
          const rateLimitResult = applyRateLimit(request, {
            namespace: 'api:upload',
            maxRequests: 10,
            windowMs: time({ minutes: 1 }),
          })

          if (!rateLimitResult.allowed) {
            return ok<UploadIdResponse>(
              {
                success: false,
                error: `Too many requests. Retry in ~${rateLimitResult.retryAfterSeconds}s.`,
              },
              { status: StatusCode.TooManyRequests },
            )
          }

          const formData = await request.formData()
          const rawFile = formData.get('file')
          const file = rawFile instanceof File ? rawFile : null
          const logId = Number(params.id)
          const secretFromForm = formData.get('secret')
          const providedSecret =
            typeof secretFromForm === 'string' ? secretFromForm : readSecretFromRequest(request)

          if (!isSecretValid(providedSecret)) {
            return ok<UploadIdResponse>(
              {
                success: false,
                error: 'Invalid secret',
              },
              { status: StatusCode.Unauthorized },
            )
          }

          if (!file) {
            return ok<UploadIdResponse>(
              {
                success: false,
                error: 'File is required',
              },
              { status: StatusCode.BadRequest },
            )
          }

          if (Number.isNaN(logId)) {
            return ok<UploadIdResponse>(
              {
                success: false,
                error: 'Invalid log ID',
              },
              { status: StatusCode.BadRequest },
            )
          }

          if (!SUPPORTED_IMAGE_TYPES.has(file.type)) {
            return ok<UploadIdResponse>(
              {
                success: false,
                error: 'Unsupported file type. Use: webp, jpg, jpeg, png',
              },
              { status: StatusCode.BadRequest },
            )
          }

          if (file.size > MAX_FILE_SIZE_BYTES) {
            return ok<UploadIdResponse>(
              {
                success: false,
                error: 'File is too large. Maximum size is 8MB',
              },
              { status: StatusCode.BadRequest },
            )
          }

          const buffer = Buffer.from(await file.arrayBuffer())
          const result = await uploadToR2(buffer, logId, file.type)

          return ok<UploadIdResponse>({
            success: true,
            result: {
              etag: result.ETag ?? null,
              versionId: result.VersionId ?? null,
            },
          })
        } catch (error) {
          return ok<UploadIdResponse>(
            {
              success: false,
              error: `Failed to upload file ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
            { status: StatusCode.InternalServerError },
          )
        }
      },
    },
  },
})
