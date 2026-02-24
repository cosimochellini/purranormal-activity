/* eslint-disable node/prefer-global/buffer */
import { createFileRoute } from '@tanstack/react-router'
import type { UploadIdResponse } from '@/types/api/upload-id'
import { uploadToR2 } from '@/utils/cloudflare'
import { badRequest, ok } from '@/utils/http'

export const Route = createFileRoute('/api/upload/$id')({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        try {
          const formData = await request.formData()
          const file = formData.get('file') as File
          const idFromQuery = new URL(request.url).searchParams.get('id')
          const logId = Number(params.id ?? idFromQuery)

          if (!file) return badRequest('File is required')
          if (Number.isNaN(logId)) return badRequest('Invalid log ID')

          const buffer = Buffer.from(await file.arrayBuffer())
          const result = await uploadToR2(buffer, logId)

          return ok<UploadIdResponse>({ success: true, result })
        } catch (error) {
          return badRequest(`Failed to upload file ${error}`)
        }
      },
    },
  },
})
