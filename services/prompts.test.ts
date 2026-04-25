import { describe, expect, it } from 'vitest'
import { ARRAY_LIMITS, CHARACTER_LIMITS } from '@/constants'
import { ImageStyle } from '@/data/enum/imageStyle'
import { LogStatus } from '@/data/enum/logStatus'
import type { LogWithCategories } from '@/db/schema'
import {
  CHARACTER_DESCRIPTIONS,
  COMMON_PROMPT_INSTRUCTIONS,
  CREATE_QUESTIONS_PROMPT,
  GENERATE_IMAGE_PROMPT,
  GENERATE_LOG_DETAILS_PROMPT,
  GENERATE_TELEGRAM_PROMPT,
} from './prompts'

describe('exported constants', () => {
  it('CHARACTER_DESCRIPTIONS includes both kitten and chick', () => {
    expect(CHARACTER_DESCRIPTIONS.kitten).toContain('Micio Strega')
    expect(CHARACTER_DESCRIPTIONS.chick).toContain('Pulcino Coraggioso')
  })

  it('COMMON_PROMPT_INSTRUCTIONS describes the general context', () => {
    expect(COMMON_PROMPT_INSTRUCTIONS).toContain('investigatore paranormale')
  })
})

describe('CREATE_QUESTIONS_PROMPT', () => {
  it('embeds the user description verbatim', () => {
    const prompt = CREATE_QUESTIONS_PROMPT('Spooky kitten event')
    expect(prompt).toContain('"Spooky kitten event"')
  })

  it('includes both character descriptions and common instructions', () => {
    const prompt = CREATE_QUESTIONS_PROMPT('x')
    expect(prompt).toContain(CHARACTER_DESCRIPTIONS.kitten)
    expect(prompt).toContain(CHARACTER_DESCRIPTIONS.chick)
    expect(prompt).toContain(COMMON_PROMPT_INSTRUCTIONS)
  })

  it('references MAX_QUESTIONS / MAX_ANSWERS / character limits', () => {
    const prompt = CREATE_QUESTIONS_PROMPT('x')
    expect(prompt).toContain(`FINO a ${ARRAY_LIMITS.MAX_QUESTIONS} domande`)
    expect(prompt).toContain(`MAX ${ARRAY_LIMITS.MAX_ANSWERS} risposte`)
    expect(prompt).toContain(`MAX ${CHARACTER_LIMITS.QUESTION} caratteri`)
    expect(prompt).toContain(`MAX ${CHARACTER_LIMITS.ANSWER} caratteri`)
  })
})

describe('GENERATE_LOG_DETAILS_PROMPT', () => {
  const baseParams = {
    description: 'A purple kitten teleported the chick',
    answers: [
      { question: 'Where?', answer: 'In the kitchen' },
      { question: 'When?', answer: 'At midnight' },
    ],
    categories: [
      { id: 1, name: 'magic' },
      { id: 2, name: 'mystery' },
    ],
    currentStyle: ImageStyle.ANIME,
  }

  it('embeds the description and answers', () => {
    const prompt = GENERATE_LOG_DETAILS_PROMPT(baseParams)
    expect(prompt).toContain('"A purple kitten teleported the chick"')
    expect(prompt).toContain('- Where?: In the kitchen')
    expect(prompt).toContain('- When?: At midnight')
  })

  it('renders categories as JSON-like fragments', () => {
    const prompt = GENERATE_LOG_DETAILS_PROMPT(baseParams)
    expect(prompt).toContain('{ "id": 1, "name": "magic" }')
    expect(prompt).toContain('{ "id": 2, "name": "mystery" }')
  })

  it('mentions the chosen image style and the title/description limits', () => {
    const prompt = GENERATE_LOG_DETAILS_PROMPT(baseParams)
    expect(prompt).toContain(`Stile: ${ImageStyle.ANIME}`)
    expect(prompt).toContain(`max ${CHARACTER_LIMITS.GENERATED_TITLE} caratteri`)
    expect(prompt).toContain(`max ${CHARACTER_LIMITS.GENERATED_DESCRIPTION} caratteri`)
    expect(prompt).toContain(`massimo ${ARRAY_LIMITS.MAX_CATEGORIES}`)
  })

  it('handles empty answers and categories', () => {
    const prompt = GENERATE_LOG_DETAILS_PROMPT({
      description: 'd',
      answers: [],
      categories: [],
      currentStyle: ImageStyle.CARTOON,
    })
    expect(prompt).toContain('"d"')
    expect(prompt).toContain(`Stile: ${ImageStyle.CARTOON}`)
  })
})

describe('GENERATE_IMAGE_PROMPT', () => {
  it('mentions the description and the chosen style twice (header + footer template)', () => {
    const prompt = GENERATE_IMAGE_PROMPT({
      description: 'cat conjures rain',
      imageStyle: ImageStyle.GIBHILI,
    })
    expect(prompt).toContain('"cat conjures rain"')
    expect(prompt).toContain(`Usa lo stile: ${ImageStyle.GIBHILI}`)
    expect(prompt).toContain(`... - ${ImageStyle.GIBHILI}`)
  })

  it('references the IMAGE_PROMPT character limit', () => {
    const prompt = GENERATE_IMAGE_PROMPT({
      description: 'd',
      imageStyle: ImageStyle.CARTOON,
    })
    expect(prompt).toContain(`sotto le ${CHARACTER_LIMITS.IMAGE_PROMPT} parole`)
  })
})

describe('GENERATE_TELEGRAM_PROMPT', () => {
  const log: LogWithCategories = {
    id: 21,
    title: 'Strange noises',
    description: 'desc',
    createdAt: 1,
    updatedAt: 2,
    status: LogStatus.ImageGenerated,
    error: null,
    imageDescription: 'imgdesc',
    categories: [1, 2],
  }

  it('uses #DAY (id*2) and embeds the canonical link URL', () => {
    const prompt = GENERATE_TELEGRAM_PROMPT({ log })
    expect(prompt).toContain('#DAY 42')
    expect(prompt).toContain('https://purranormal-activity.pages.dev/21')
  })

  it('includes the JSON serialization of the log', () => {
    const prompt = GENERATE_TELEGRAM_PROMPT({ log })
    expect(prompt).toContain(JSON.stringify(log))
  })

  it('mentions the telegram description and link character limits', () => {
    const prompt = GENERATE_TELEGRAM_PROMPT({ log })
    expect(prompt).toContain(`max ${CHARACTER_LIMITS.TELEGRAM_DESCRIPTION} caratteri`)
    expect(prompt).toContain(`max ${CHARACTER_LIMITS.TELEGRAM_LINK} caratteri`)
  })
})
