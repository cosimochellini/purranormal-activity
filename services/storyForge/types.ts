import type { ImageStyle } from '@/data/enum/imageStyle'
import type { Category, LogWithCategories } from '@/db/schema'

export type AIError = 'parse' | 'model' | 'validation'

export type AIResult<T> = { ok: true; value: T } | { ok: false; error: AIError; message: string }

export interface QuestionSpec {
  question: string
  availableAnswers: string[]
}

export interface Answer {
  question: string
  answer: string
}

export interface LogDetailsCategory {
  id: number
  name: string
}

export interface LogDetails {
  title: string
  description: string
  categories: LogDetailsCategory[]
  imageDescription: string
}

export interface StoryForge {
  questions(description: string): Promise<AIResult<QuestionSpec[]>>
  logDetails(description: string, answers: Answer[]): Promise<AIResult<LogDetails>>
  imagePrompt(description: string): Promise<AIResult<string>>
  telegramMessage(log: LogWithCategories): Promise<AIResult<string>>
  invalidateCategories(): void
}

export interface CategoriesPort {
  all(): Promise<Category[]>
  invalidate(): void
}

export interface LlmPort {
  text(opts: { model: string; prompt: string }): Promise<string>
}

export interface Deps {
  categories: CategoriesPort
  llm: LlmPort
  randomStyle: () => ImageStyle
}
