import { generateImageBase64 } from '@/services/imageGen'
import type { AiImagePort } from '../ports'

export const defaultAiImage: AiImagePort = {
  generateBase64: (prompt) => generateImageBase64(prompt),
}
