import { randomImageStyle } from '../data/enum/imageStyle'
import { category } from '../db/schema'
import { db } from '../drizzle'
import { openai } from '../instances/openai'
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
  const content = CREATE_QUESTIONS_PROMPT(description)

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content }],
      stream: false,
    })

    const parsedContent = JSON.parse(completion.choices[0]?.message?.content || '[]')
    return parsedContent as CreateQuestionsResponse[]
  }
  catch (error) {
    logger.error('Error generating follow-up questions:', error)
    return []
  }
}

export interface GenerateLogDetailsResponse {
  title: string
  description: string
  categories: { id: number, name: string }[]
  missingCategories: string[]
  imageDescription: string
}

export async function generateLogDetails(description: string, answers: { question: string, answer: string }[]) {
  const categories = await db.select({ id: category.id, name: category.name }).from(category)
  const currentStyle = randomImageStyle()

  const content = GENERATE_LOG_DETAILS_PROMPT({ description, answers, categories, currentStyle })

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content }],
      response_format: { type: 'json_object' },
    })

    const rawContent = completion.choices[0]?.message?.content || '{}'
    return JSON.parse(rawContent) as GenerateLogDetailsResponse
  }
  catch (error) {
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

export async function generateImage(imagePrompt: string) {
  try {
    const imageResponse = await openai.images.generate({
      model: 'dall-e-3',
      prompt: imagePrompt,
      n: 1,
      size: '1024x1024',
    })

    const imageData = imageResponse.data[0]?.url

    if (!imageData)
      throw new Error('Failed to generate image data')

    return imageData
  }
  catch (error) {
    logger.error('Error generating image:', error)
    throw new Error('Image generation failed')
  }
}

export async function generateImagePrompt(description: string) {
  const imageStyle = randomImageStyle()

  const content = GENERATE_IMAGE_PROMPT({ description, imageStyle })

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content }],
    })

    const ret = completion.choices[0]?.message?.content

    if (!ret) {
      throw new Error('Failed to generate image prompt')
    }

    return ret
  }
  catch (error) {
    logger.error('Error generating image prompt:', error)
    throw new Error('Image prompt generation failed')
  }
}
