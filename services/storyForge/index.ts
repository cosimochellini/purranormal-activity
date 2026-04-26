import { type ImageStyle, randomImageStyle } from '@/data/enum/imageStyle'
import type { LogWithCategories } from '@/db/schema'
import { logger } from '@/utils/logger'
import { createDefaultCategories } from './categories'
import { defaultLlm } from './llm'
import {
  CREATE_QUESTIONS_PROMPT,
  GENERATE_IMAGE_PROMPT,
  GENERATE_LOG_DETAILS_PROMPT,
  GENERATE_TELEGRAM_PROMPT,
} from './prompts'
import type {
  AIResult,
  Answer,
  Deps,
  LogDetails,
  LogDetailsCategory,
  QuestionSpec,
  StoryForge,
} from './types'

export type {
  AIError,
  AIResult,
  Answer,
  LogDetails,
  LogDetailsCategory,
  QuestionSpec,
  StoryForge,
} from './types'

const QUESTIONS_MODEL = 'gpt-5-mini'
const LOG_DETAILS_MODEL = 'gpt-5.2'
const IMAGE_PROMPT_MODEL = 'gpt-5.2'
const TELEGRAM_MODEL = 'gpt-5-mini'

const errorMessage = (err: unknown): string => {
  if (err instanceof Error) return err.message || err.name || 'Error'
  if (typeof err === 'string') return err
  if (err === undefined) return 'undefined'
  if (err === null) return 'null'
  try {
    return JSON.stringify(err)
  } catch {
    return String(err)
  }
}

const stripHtmlFences = (message: string) =>
  message.replace(/^```html\s*/, '').replace(/\s*```$/, '')

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((entry) => typeof entry === 'string')

const isQuestionSpec = (value: unknown): value is QuestionSpec => {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return typeof v.question === 'string' && isStringArray(v.availableAnswers)
}

const isLogDetailsCategory = (value: unknown): value is LogDetailsCategory => {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return typeof v.id === 'number' && typeof v.name === 'string'
}

const nonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0

const isLogDetails = (value: unknown): value is LogDetails => {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return (
    nonEmptyString(v.title) &&
    nonEmptyString(v.description) &&
    nonEmptyString(v.imageDescription) &&
    Array.isArray(v.categories) &&
    v.categories.every(isLogDetailsCategory)
  )
}

export function createStoryForge(overrides: Partial<Deps> = {}): StoryForge {
  const deps: Deps = {
    categories: overrides.categories ?? createDefaultCategories(),
    llm: overrides.llm ?? defaultLlm,
    randomStyle: overrides.randomStyle ?? (randomImageStyle as () => ImageStyle),
  }

  async function questions(description: string): Promise<AIResult<QuestionSpec[]>> {
    const prompt = CREATE_QUESTIONS_PROMPT(description)

    let raw: string
    try {
      raw = await deps.llm.text({ model: QUESTIONS_MODEL, prompt })
    } catch (error) {
      logger.error('storyForge.questions: model call failed', error)
      return { ok: false, error: 'model', message: errorMessage(error) }
    }

    let parsed: unknown
    try {
      parsed = JSON.parse(raw || '[]')
    } catch (error) {
      logger.error('storyForge.questions: parse failed', error)
      return { ok: false, error: 'parse', message: errorMessage(error) }
    }

    if (!Array.isArray(parsed) || !parsed.every(isQuestionSpec)) {
      return {
        ok: false,
        error: 'validation',
        message: 'Expected QuestionSpec[]',
      }
    }

    return { ok: true, value: parsed }
  }

  async function logDetails(description: string, answers: Answer[]): Promise<AIResult<LogDetails>> {
    let categories: Awaited<ReturnType<typeof deps.categories.all>>
    try {
      categories = await deps.categories.all()
    } catch (error) {
      logger.error('storyForge.logDetails: categories fetch failed', error)
      return { ok: false, error: 'model', message: errorMessage(error) }
    }

    const currentStyle = deps.randomStyle()
    const prompt = GENERATE_LOG_DETAILS_PROMPT({
      description,
      answers,
      categories: categories.map((c) => ({ id: c.id, name: c.name })),
      currentStyle,
    })

    let raw: string
    try {
      raw = await deps.llm.text({ model: LOG_DETAILS_MODEL, prompt })
    } catch (error) {
      logger.error('storyForge.logDetails: model call failed', error)
      return { ok: false, error: 'model', message: errorMessage(error) }
    }

    let parsed: unknown
    try {
      parsed = JSON.parse(raw || '{}')
    } catch (error) {
      logger.error('storyForge.logDetails: parse failed', error)
      return { ok: false, error: 'parse', message: errorMessage(error) }
    }

    if (!isLogDetails(parsed)) {
      return {
        ok: false,
        error: 'validation',
        message: 'Expected LogDetails shape',
      }
    }

    return { ok: true, value: parsed }
  }

  async function imagePrompt(description: string): Promise<AIResult<string>> {
    const imageStyle = deps.randomStyle()
    const prompt = GENERATE_IMAGE_PROMPT({ description, imageStyle })

    let raw: string
    try {
      raw = await deps.llm.text({ model: IMAGE_PROMPT_MODEL, prompt })
    } catch (error) {
      logger.error('storyForge.imagePrompt: model call failed', error)
      return { ok: false, error: 'model', message: errorMessage(error) }
    }

    // Reject whitespace-only responses too — DALL-E would otherwise be
    // invoked with a useless prompt downstream in services/trigger.ts.
    if (!raw.trim()) {
      return { ok: false, error: 'validation', message: 'Empty image prompt' }
    }

    return { ok: true, value: raw }
  }

  async function telegramMessage(log: LogWithCategories): Promise<AIResult<string>> {
    const prompt = GENERATE_TELEGRAM_PROMPT({ log })

    let raw: string
    try {
      raw = await deps.llm.text({ model: TELEGRAM_MODEL, prompt })
    } catch (error) {
      logger.error('storyForge.telegramMessage: model call failed', error)
      return { ok: false, error: 'model', message: errorMessage(error) }
    }

    const stripped = stripHtmlFences(raw)
    // After fence-stripping, a whitespace-only payload would still be sent
    // to Telegram and rendered literally — treat it as a validation error.
    if (!stripped.trim()) {
      return { ok: false, error: 'validation', message: 'Empty telegram message' }
    }

    return { ok: true, value: stripped }
  }

  async function categories(): Promise<LogDetailsCategory[]> {
    const rows = await deps.categories.all()
    return rows.map((row) => ({ id: row.id, name: row.name }))
  }

  return {
    questions,
    logDetails,
    imagePrompt,
    telegramMessage,
    categories,
    invalidateCategories: () => deps.categories.invalidate(),
  }
}

/**
 * Production singleton wired to the default Drizzle + OpenAI adapters.
 */
export const storyForge: StoryForge = createStoryForge()
