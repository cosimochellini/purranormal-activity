import { openai } from '@ai-sdk/openai'
import { experimental_generateImage as generateImage, generateText } from 'ai'
import { randomImageStyle } from '../data/enum/imageStyle'
import { category } from '../db/schema'
import { db } from '../drizzle'
import { logger } from '../utils/logger'
import {
  CREATE_QUESTIONS_PROMPT,
  GENERATE_IMAGE_PROMPT,
  GENERATE_LOG_DETAILS_PROMPT,
} from './prompts'

interface CreateQuestionsResponse {
  question: string
  availableAnswers: string[]
}

export async function createQuestions(description: string) {
  const prompt = CREATE_QUESTIONS_PROMPT(description)

  try {
    const { text } = await generateText({
      model: openai('o3-mini'),
      prompt,
    })

    const parsedContent = JSON.parse(text || '[]')
    return parsedContent as CreateQuestionsResponse[]
  } catch (error) {
    logger.error('Error generating follow-up questions:', error)
    return []
  }
}

export interface GenerateLogDetailsResponse {
  title: string
  description: string
  categories: { id: number; name: string }[]
  missingCategories: string[]
  imageDescription: string
}

export async function generateLogDetails(
  description: string,
  answers: { question: string; answer: string }[],
) {
  const categories = await db.select({ id: category.id, name: category.name }).from(category)
  const currentStyle = randomImageStyle()

  const prompt = GENERATE_LOG_DETAILS_PROMPT({ description, answers, categories, currentStyle })

  try {
    const { text } = await generateText({
      model: openai('o3'),
      prompt,
    })

    const rawContent = text || '{}'

    return JSON.parse(rawContent) as GenerateLogDetailsResponse
  } catch (error) {
    logger.error('Error generating log details:', error)
    return {
      title: '',
      description: '',
      categories: [],
      missingCategories: [],
      imageDescription: '',
    }
  }
}

export async function generateImageBase64(imagePrompt: string) {
  try {
    const result = await generateImage({
      model: openai.image('gpt-image-1'),
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
    const { text } = await generateText({
      model: openai('gpt-4o'),
      prompt,
    })

    const ret = text

    if (!ret) {
      throw new Error('Failed to generate image prompt')
    }

    return ret
  } catch (error) {
    logger.error('Error generating image prompt:', error)
    throw new Error('Image prompt generation failed')
  }
}
