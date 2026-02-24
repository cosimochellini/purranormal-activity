import type { Log } from '@/db/schema'

export type LogIdGetResponse =
  | {
      success: true
      data: Log
    }
  | {
      success: false
    }

export interface LogIdPutBody {
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
  secret: string
}

export type LogIdDeleteResponse =
  | {
      success: true
    }
  | {
      success: false
      error?: string
      errors?: Partial<Record<keyof LogIdDeleteBody, string[]>>
    }
