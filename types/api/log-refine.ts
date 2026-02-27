export interface FollowUpQuestion {
  question: string
  availableAnswers: string[]
}

export interface LogRefineBody {
  description: string
}

export type LogRefineResponse =
  | {
      success: true
      content: FollowUpQuestion[]
    }
  | {
      success: false
      errors: Partial<Record<keyof LogRefineBody, string[]>>
    }
