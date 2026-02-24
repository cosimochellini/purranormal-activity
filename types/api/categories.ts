import type { Category } from '@/db/schema'

export type CategoriesGetResponse = Category[]

export interface CategoriesPostBody {
  categories: string[]
}

export type CategoriesPostResponse =
  | {
      success: true
      categories: { id: number; name: string }[]
    }
  | {
      success: false
      errors: Partial<Record<keyof CategoriesPostBody, string[]>>
    }
