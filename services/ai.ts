import { openai } from '@ai-sdk/openai'
import { generateImage, generateObject, generateText } from 'ai'
import { z } from 'zod'
import { ARRAY_LIMITS, CHARACTER_LIMITS } from '@/constants'
import { type ImageStyle, randomImageStyle } from '../data/enum/imageStyle'
import { category, type LogWithCategories } from '../db/schema'
import { db } from '../drizzle'
import { logger } from '../utils/logger'
import {
  CREATE_QUESTIONS_PROMPT,
  GENERATE_IMAGE_PROMPT,
  GENERATE_LOG_DETAILS_PROMPT,
  GENERATE_TELEGRAM_PROMPT,
} from './prompts'

interface CreateQuestionsResponse {
  question: string
  availableAnswers: string[]
}

const MAX_IMAGE_PROMPT_CHARS = 1_500
const MAX_CATEGORY_NAME_CHARS = 60
const MIN_FOLLOWUP_ANSWERS = 2
const REQUIRED_KITTEN_FRAGMENT = 'black kitten with a purple witch hat and bright green eyes'
const REQUIRED_CHICK_FRAGMENT = 'small yellow chick'

const normalizeText = (text: string, max: number) => text.replace(/\s+/g, ' ').trim().slice(0, max)
const stripWrappingQuotes = (text: string) => text.replace(/^[`'"]+|[`'"]+$/g, '')
const dedupeNormalizedText = (items: string[], max: number) =>
  Array.from(
    new Map(
      items
        .map((item) => normalizeText(item, max))
        .filter((item) => item.length > 0)
        .map((item) => [item.toLowerCase(), item]),
    ).values(),
  )

const buildFallbackImagePrompt = (description: string, imageStyle: ImageStyle) => {
  const sceneHint =
    normalizeText(description, 280) ||
    'a cozy home with floating objects and sparkling magical traces'

  return normalizeText(
    `Whimsical paranormal scene, cinematic composition. A ${REQUIRED_KITTEN_FRAGMENT} is the main subject, casting chaotic glowing magic. A ${REQUIRED_CHICK_FRAGMENT} reacts with awe and fear in the background. Environment details inspired by the event: ${sceneHint}. Soft volumetric lighting, rich textures, cute and mysterious atmosphere, no text, no logos, no watermark. Style: ${imageStyle}`,
    MAX_IMAGE_PROMPT_CHARS,
  )
}

const normalizeImagePrompt = (prompt: string, imageStyle: ImageStyle) => {
  let normalized = normalizeText(stripWrappingQuotes(prompt), MAX_IMAGE_PROMPT_CHARS)

  if (!normalized) return ''

  if (!normalized.toLowerCase().includes(REQUIRED_KITTEN_FRAGMENT)) {
    normalized = `${REQUIRED_KITTEN_FRAGMENT}. ${normalized}`
  }

  if (!normalized.toLowerCase().includes(REQUIRED_CHICK_FRAGMENT)) {
    normalized = `${normalized} A ${REQUIRED_CHICK_FRAGMENT} is visible nearby.`
  }

  if (!/style\s*:/i.test(normalized)) {
    normalized = `${normalized} Style: ${imageStyle}`
  }

  return normalizeText(normalized, MAX_IMAGE_PROMPT_CHARS)
}

const questionsSchema = z
  .array(
    z.object({
      question: z.string().min(1).max(CHARACTER_LIMITS.QUESTION),
      availableAnswers: z
        .array(z.string().min(1).max(CHARACTER_LIMITS.ANSWER))
        .min(MIN_FOLLOWUP_ANSWERS)
        .max(ARRAY_LIMITS.MAX_ANSWERS),
    }),
  )
  .max(ARRAY_LIMITS.MAX_QUESTIONS)

const categorySchema = z.object({
  id: z.coerce.number().int().positive(),
  name: z.string().min(1).max(MAX_CATEGORY_NAME_CHARS).optional(),
})

const logDetailsSchema = z.object({
  title: z.string().min(1).max(CHARACTER_LIMITS.GENERATED_TITLE),
  description: z.string().min(1).max(CHARACTER_LIMITS.GENERATED_DESCRIPTION),
  categories: z.array(categorySchema).max(ARRAY_LIMITS.MAX_CATEGORIES).default([]),
  missingCategories: z
    .array(z.string().min(1).max(MAX_CATEGORY_NAME_CHARS))
    .max(ARRAY_LIMITS.MAX_CATEGORIES)
    .default([]),
  imageDescription: z.string().min(1).max(MAX_IMAGE_PROMPT_CHARS),
})

const imagePromptSchema = z.object({
  prompt: z.string().min(1).max(MAX_IMAGE_PROMPT_CHARS),
})

export async function createQuestions(description: string) {
  const prompt = CREATE_QUESTIONS_PROMPT(description)

  try {
    const { object } = await generateObject({
      model: openai('gpt-5-mini'),
      prompt,
      schema: questionsSchema,
    })

    const normalized = object
      .map((question) => ({
        question: normalizeText(question.question, CHARACTER_LIMITS.QUESTION),
        availableAnswers: dedupeNormalizedText(
          question.availableAnswers,
          CHARACTER_LIMITS.ANSWER,
        ).slice(0, ARRAY_LIMITS.MAX_ANSWERS),
      }))
      .filter(
        (question) =>
          question.question.length > 0 && question.availableAnswers.length >= MIN_FOLLOWUP_ANSWERS,
      )

    const uniqueQuestions = Array.from(
      new Map(normalized.map((question) => [question.question.toLowerCase(), question])).values(),
    ).slice(0, ARRAY_LIMITS.MAX_QUESTIONS)

    return uniqueQuestions satisfies CreateQuestionsResponse[]
  } catch (error) {
    logger.error('Error generating follow-up questions:', error)
    return []
  }
}

interface Category {
  id: number
  name: string
}

export interface GenerateLogDetailsResponse {
  title: string
  description: string
  categories: Category[]
  missingCategories: string[]
  imageDescription: string
}

function fallbackLogDetails(
  description: string,
  imageStyle: ImageStyle,
): GenerateLogDetailsResponse {
  const normalizedDescription = normalizeText(description, CHARACTER_LIMITS.GENERATED_DESCRIPTION)

  return {
    title: normalizeText(
      normalizedDescription || 'Paranormal Event',
      CHARACTER_LIMITS.GENERATED_TITLE,
    ),
    description: normalizedDescription || 'A mysterious paranormal event was reported.',
    categories: [],
    missingCategories: [],
    imageDescription: buildFallbackImagePrompt(description, imageStyle),
  }
}

export async function generateLogDetails(
  description: string,
  answers: { question: string; answer: string }[],
) {
  const categories = await db.select({ id: category.id, name: category.name }).from(category)
  const categoriesById = new Map(categories.map((x) => [x.id, x]))
  const categoriesByName = new Set(categories.map((x) => x.name.toLowerCase()))
  const currentStyle = randomImageStyle()

  const prompt = GENERATE_LOG_DETAILS_PROMPT({ description, answers, categories, currentStyle })

  try {
    const { object } = await generateObject({
      model: openai('gpt-5.2'),
      prompt,
      schema: logDetailsSchema,
      temperature: 0.7,
    })

    const knownCategories = Array.from(
      new Map(
        object.categories
          .filter((item) => categoriesById.has(item.id))
          .map((item) => {
            const known = categoriesById.get(item.id)
            return [item.id, { id: item.id, name: known?.name || item.name || '' }]
          }),
      ).values(),
    )

    const missingCategories = dedupeNormalizedText(
      object.missingCategories,
      MAX_CATEGORY_NAME_CHARS,
    )
      .filter((item) => !categoriesByName.has(item.toLowerCase()))
      .slice(0, ARRAY_LIMITS.MAX_CATEGORIES)

    const imageDescription = normalizeImagePrompt(object.imageDescription, currentStyle)

    return {
      title: normalizeText(object.title, CHARACTER_LIMITS.GENERATED_TITLE),
      description: normalizeText(object.description, CHARACTER_LIMITS.GENERATED_DESCRIPTION),
      categories: knownCategories,
      missingCategories,
      imageDescription: imageDescription || buildFallbackImagePrompt(description, currentStyle),
    } satisfies GenerateLogDetailsResponse
  } catch (error) {
    logger.error('Error generating log details:', error)
    return fallbackLogDetails(description, currentStyle)
  }
}

export async function generateImageBase64(imagePrompt: string) {
  try {
    const result = await generateImage({
      model: openai.image('gpt-image-1.5'),
      prompt: imagePrompt,
      n: 1,
      size: '1024x1024',
    })

    const imageData = result.images[0]?.base64

    if (!imageData) throw new Error('Failed to generate image data')

    return imageData
  } catch (error) {
    logger.error('Error generating image:', error)
    throw new Error('Image generation failed')
  }
}

export async function generateImagePrompt(description: string) {
  const imageStyle = randomImageStyle()

  const prompt = GENERATE_IMAGE_PROMPT({ description, imageStyle })

  try {
    const { object } = await generateObject({
      model: openai('gpt-5.2'),
      prompt,
      schema: imagePromptSchema,
      temperature: 0.6,
    })

    const normalized = normalizeImagePrompt(object.prompt, imageStyle)

    if (!normalized) {
      logger.warn('Generated image prompt was empty after normalization; using fallback')
      return buildFallbackImagePrompt(description, imageStyle)
    }

    return normalized
  } catch (error) {
    logger.error('Error generating image prompt:', error)
    return buildFallbackImagePrompt(description, imageStyle)
  }
}

/**
 * ensure the the message do not contains ```html at the beginning and ``` at the end
 */
const removeHTMLTags = (message: string) =>
  message
    .replace(/^```html\s*/, '') // Remove ```html at the beginning with optional whitespace
    .replace(/\s*```$/, '') /* Remove ``` at the end with optional whitespace*/ // Remove ``` at the end with optional whitespace

export async function generateTelegramMessage(log: LogWithCategories) {
  const prompt = GENERATE_TELEGRAM_PROMPT({ log })
  const { text } = await generateText({
    model: openai('gpt-5-mini'),
    prompt,
  })

  return removeHTMLTags(text)
}
