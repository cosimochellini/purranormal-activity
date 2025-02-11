import { NextRequest } from 'next/server'
import { uploadToR2 } from '@/utils/cloudflare'
import { badRequest, ok } from '../../../../utils/http'

export interface UploadResponse {
  success: boolean
  errors?: Record<string, string[]>
}

interface RequestParams  {
  id: string
}

export async function POST(request: NextRequest, { params }: { params: RequestParams }) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file)
      return badRequest('File is required')

    const buffer = Buffer.from(await file.arrayBuffer())
    const logId = Number(params.id)

    const result = await uploadToR2(buffer, logId)

    return ok({ success: true, result })
  }
  catch (error) {
    return badRequest('Failed to upload file ' + error)
  }
}
