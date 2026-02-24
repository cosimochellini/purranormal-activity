export interface UploadIdResponse {
  success: boolean
  result?: unknown
  errors?: Record<string, string[]>
}
