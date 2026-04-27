import { storyForge } from '@/services/storyForge'
import type { AiTextPort } from '../ports'

export const defaultAiText: AiTextPort = {
  imagePrompt: (description) => storyForge.imagePrompt(description),
}
