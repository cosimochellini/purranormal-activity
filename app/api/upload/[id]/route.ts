/* eslint-disable node/prefer-global/buffer */
import type { UploadIdResponse } from '@/types/api/upload-id'
import { uploadToR2 } from '@/utils/cloudflare'
import { badRequest, ok } from '../../../../utils/http'

export const runtime = 'edge'
export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    const logId = Number(new URL(request.url).searchParams.get('id'))

    if (!file) return badRequest('File is required')

    if (Number.isNaN(logId)) return badRequest('Invalid log ID')

    const buffer = Buffer.from(await file.arrayBuffer())

    const result = await uploadToR2(buffer, logId)

    return ok<UploadIdResponse>({ success: true, result })
  } catch (error) {
    return badRequest(`Failed to upload file ${error}`)
  }
}
