import { openai } from '@ai-sdk/openai'
import { generateText } from 'ai'
import type { LlmPort } from './types'

export const defaultLlm: LlmPort = {
  async text({ model, prompt }) {
    const { text } = await generateText({
      model: openai(model),
      prompt,
    })
    return text ?? ''
  },
}
