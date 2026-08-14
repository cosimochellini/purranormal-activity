export interface LogPostBody {
  title: string
  description: string
  categories: number[]
  secret: string
}

export type LogPostResponse =
  | {
      success: true
    }
  | {
      success: false
      errors: Partial<Record<keyof LogPostBody | 'general', string[]>>
    }
