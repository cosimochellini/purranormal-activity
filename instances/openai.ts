import { OPENAI_API_KEY } from '@/env/openai'
import OpenAI from 'openai'

export const openai = new OpenAI({
  apiKey: OPENAI_API_KEY,
})
