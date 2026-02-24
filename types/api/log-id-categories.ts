export interface LogIdCategoriesPostBody {
  categories: number[]
}

export type LogIdCategoriesPostResponse =
  | {
      success: true
    }
  | {
      success: false
      errors: Partial<Record<keyof LogIdCategoriesPostBody, string[]>>
    }
