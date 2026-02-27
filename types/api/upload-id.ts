export interface UploadIdResult {
  etag: string | null
  versionId: string | null
}

export type UploadIdResponse =
  | {
      success: true
      result: UploadIdResult
    }
  | {
      success: false
      error?: string
      errors?: Record<string, string[]>
    }
