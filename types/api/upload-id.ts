export type UploadIdResponse =
  | {
      success: true
    }
  | {
      success: false
      error?: string
      errors?: Record<string, string[]>
    }
