// Contract for services/storyForge/index.ts
// This file is type-only and intentionally NOT imported by the runtime.
// It is a snapshot of the public surface, used for spec-vs-implementation diff.

import type { LogWithCategories } from '@/db/schema'

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

export interface LogDetails {
  title: string
  description: string
  categories: { id: number; name: string }[]
  imageDescription: string
}

export interface StoryForge {
  questions(description: string): Promise<AIResult<QuestionSpec[]>>
  logDetails(description: string, answers: Answer[]): Promise<AIResult<LogDetails>>
  imagePrompt(description: string): Promise<AIResult<string>>
  telegramMessage(log: LogWithCategories): Promise<AIResult<string>>
  invalidateCategories(): void
}

interface Category {
  id: number
  name: string
}

export interface Deps {
  categories: { all(): Promise<Category[]>; invalidate(): void }
  llm: { text(opts: { model: string; prompt: string }): Promise<string> }
  randomStyle: () => string
}

export declare const storyForge: StoryForge
export declare const createStoryForge: (deps?: Partial<Deps>) => StoryForge
