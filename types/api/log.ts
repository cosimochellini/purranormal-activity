export interface LogPostBody {
  title: string
  description: string
  categories: number[]
}

export type LogPostResponse =
  | {
      success: true
    }
  | {
      success: false
      errors: Partial<Record<keyof LogPostBody, string[]>>
    }
