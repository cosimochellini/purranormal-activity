import type { Log } from '@/db/schema'

export interface LogIdPutBody {
  id: number
  title: string
  description: string
  categories: number[]
  imageDescription: string | null
  secret: string
}

export type LogIdPutResponse =
  | {
      success: true
      data: Log
    }
  | {
      success: false
      errors: Partial<Record<keyof LogIdPutBody, string[]>>
    }

export interface LogIdDeleteBody {
  id: number
  secret: string
}

export type LogIdDeleteResponse =
  | {
      success: true
    }
  | {
      success: false
      error: string
    }
