import { uploadToR2 } from '@/utils/cloudflare'
/* eslint-disable node/prefer-global/buffer */
import type { NextRequest } from 'next/server'
import { badRequest, ok } from '../../../../utils/http'

export interface UploadResponse {
  success: boolean
  errors?: Record<string, string[]>
}

export const runtime = 'edge'
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    const logId = Number(request.nextUrl.searchParams.get('id'))

    if (!file) return badRequest('File is required')

    if (Number.isNaN(logId)) return badRequest('Invalid log ID')

    const buffer = Buffer.from(await file.arrayBuffer())

    const result = await uploadToR2(buffer, logId)

    return ok({ success: true, result })
  } catch (error) {
    return badRequest(`Failed to upload file ${error}`)
  }
}
