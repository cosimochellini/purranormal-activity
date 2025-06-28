import OpenAI from 'openai'
import { OPENAI_API_KEY } from '@/env/openai'

export const openai = new OpenAI({
  apiKey: OPENAI_API_KEY,
})
