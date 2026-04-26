import { openai } from '@ai-sdk/openai'
import { generateImage } from 'ai'
import { logger } from '@/utils/logger'

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
