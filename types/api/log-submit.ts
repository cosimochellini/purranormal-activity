export interface LogSubmitAnswer {
  question: string
  answer: string
}

export interface LogSubmitBody {
  description: string
  answers: LogSubmitAnswer[]
  secret: string
}

export type LogSubmitResponse =
  | {
      success: true
      id: number
      missingCategories: string[]
    }
  | {
      success: false
      errors: Partial<Record<keyof LogSubmitBody | 'general', string[]>>
    }
