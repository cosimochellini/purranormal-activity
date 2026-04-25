import { beforeEach, describe, expect, it, vi } from 'vitest'
import { LogStatus } from '@/data/enum/logStatus'
import type { LogWithCategories } from '@/db/schema'
import { logger } from '@/utils/logger'

const { fakeDb, generateText, generateImage } = vi.hoisted(() => {
  // biome-ignore lint/suspicious/noExplicitAny: chainable proxy needs untyped self-reference
  const proxy: Record<string, any> = {}
  const chainable = (name: string) => {
    proxy[name] = vi.fn(() => proxy)
  }
  ;[
    'select',
    'from',
    'where',
    'leftJoin',
    'innerJoin',
    'orderBy',
    'groupBy',
    'limit',
    'offset',
    'insert',
    'values',
    'update',
    'set',
    'delete',
  ].forEach(chainable)
  ;['all', 'get', 'returning', 'run', 'execute'].forEach((t) => {
    proxy[t] = vi.fn(async () => undefined)
  })

  return {
    fakeDb: proxy,
    generateText: vi.fn(async () => ({ text: '' })),
    generateImage: vi.fn(async () => ({ images: [] })),
  }
})

vi.mock('@/drizzle', () => ({ db: fakeDb }))

vi.mock('ai', () => ({
  generateText,
  generateImage,
}))

vi.mock('@ai-sdk/openai', () => {
  const fn = vi.fn((id: string) => ({ id }))
  // openai.image('...') is also called
  Object.assign(fn, { image: vi.fn((id: string) => ({ image: id })) })
  return { openai: fn }
})

import {
  createQuestions,
  generateImageBase64,
  generateImagePrompt,
  generateLogDetails,
  generateTelegramMessage,
} from './ai'

const reArmChainables = () => {
  for (const key of [
    'select',
    'from',
    'where',
    'leftJoin',
    'innerJoin',
    'orderBy',
    'groupBy',
    'limit',
    'offset',
    'insert',
    'values',
    'update',
    'set',
    'delete',
  ]) {
    ;(fakeDb[key as keyof typeof fakeDb] as ReturnType<typeof vi.fn>).mockImplementation(
      () => fakeDb,
    )
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  reArmChainables()
})

describe('createQuestions', () => {
  it('returns parsed questions on success', async () => {
    const payload = [
      { question: 'Q1', availableAnswers: ['a', 'b', 'c'] },
      { question: 'Q2', availableAnswers: ['x', 'y'] },
    ]
    generateText.mockResolvedValueOnce({ text: JSON.stringify(payload) })

    const result = await createQuestions('a haunted kettle')
    expect(result).toEqual(payload)
    expect(generateText).toHaveBeenCalledTimes(1)
  })

  it('returns [] when the JSON is invalid (logs the error)', async () => {
    generateText.mockResolvedValueOnce({ text: 'not json' })
    const result = await createQuestions('x')
    expect(result).toEqual([])
    expect(vi.mocked(logger.error)).toHaveBeenCalledWith(
      'Error generating follow-up questions:',
      expect.any(Error),
    )
  })

  it('returns [] when text is empty (parses default "[]")', async () => {
    generateText.mockResolvedValueOnce({ text: '' })
    const result = await createQuestions('x')
    expect(result).toEqual([])
  })

  it('returns [] when generateText throws', async () => {
    generateText.mockRejectedValueOnce(new Error('upstream'))
    const result = await createQuestions('x')
    expect(result).toEqual([])
  })
})

describe('generateLogDetails', () => {
  const expectedDefaults = {
    title: '',
    description: '',
    categories: [],
    missingCategories: [],
    imageDescription: '',
  }

  it('returns the parsed details on success', async () => {
    fakeDb.from.mockResolvedValueOnce([{ id: 1, name: 'magic' }])
    const payload = {
      title: 'Catastrophe',
      description: 'desc',
      categories: [{ id: 1, name: 'magic' }],
      imageDescription: 'an image',
    }
    generateText.mockResolvedValueOnce({ text: JSON.stringify(payload) })

    const result = await generateLogDetails('event', [])
    expect(result).toEqual(payload)
  })

  it('returns the default placeholder shape on parse failure', async () => {
    fakeDb.from.mockResolvedValueOnce([])
    generateText.mockResolvedValueOnce({ text: 'not-json' })
    const result = await generateLogDetails('event', [])
    expect(result).toEqual(expectedDefaults)
    expect(vi.mocked(logger.error)).toHaveBeenCalledWith(
      'Error generating log details:',
      expect.any(Error),
    )
  })

  it('returns defaults when generateText throws', async () => {
    fakeDb.from.mockResolvedValueOnce([])
    generateText.mockRejectedValueOnce(new Error('boom'))
    const result = await generateLogDetails('event', [])
    expect(result).toEqual(expectedDefaults)
  })
})

describe('generateImageBase64', () => {
  it('returns the base64 string of the first generated image', async () => {
    generateImage.mockResolvedValueOnce({ images: [{ base64: 'AAA==' }] })
    const result = await generateImageBase64('a prompt')
    expect(result).toBe('AAA==')
  })

  it('throws "Image generation failed" when no data is returned', async () => {
    generateImage.mockResolvedValueOnce({ images: [] })
    await expect(generateImageBase64('p')).rejects.toThrow('Image generation failed')
    expect(vi.mocked(logger.error)).toHaveBeenCalledWith(
      'Error generating image:',
      expect.any(Error),
    )
  })

  it('throws when generateImage itself rejects', async () => {
    generateImage.mockRejectedValueOnce(new Error('upstream'))
    await expect(generateImageBase64('p')).rejects.toThrow('Image generation failed')
  })
})

describe('generateImagePrompt', () => {
  it('returns the generated prompt text', async () => {
    generateText.mockResolvedValueOnce({ text: 'a magical image prompt' })
    const result = await generateImagePrompt('event description')
    expect(result).toBe('a magical image prompt')
  })

  it('throws when text is empty', async () => {
    generateText.mockResolvedValueOnce({ text: '' })
    await expect(generateImagePrompt('x')).rejects.toThrow('Image prompt generation failed')
  })

  it('throws when generateText itself rejects', async () => {
    generateText.mockRejectedValueOnce(new Error('boom'))
    await expect(generateImagePrompt('x')).rejects.toThrow('Image prompt generation failed')
  })
})

describe('generateTelegramMessage', () => {
  const log: LogWithCategories = {
    id: 1,
    title: 't',
    description: 'd',
    createdAt: 1,
    updatedAt: 1,
    status: LogStatus.ImageGenerated,
    error: null,
    imageDescription: 'img',
    categories: [],
  }

  it('returns the raw text when no markdown fences are present', async () => {
    generateText.mockResolvedValueOnce({ text: '<b>hi</b>' })
    const result = await generateTelegramMessage(log)
    expect(result).toBe('<b>hi</b>')
  })

  it('strips ```html ... ``` fences from generated content', async () => {
    generateText.mockResolvedValueOnce({ text: '```html\n<b>hi</b>\n```' })
    const result = await generateTelegramMessage(log)
    expect(result).toBe('<b>hi</b>')
  })

  it('strips trailing ``` even without an opening fence', async () => {
    generateText.mockResolvedValueOnce({ text: '<b>hi</b>\n```' })
    const result = await generateTelegramMessage(log)
    expect(result).toBe('<b>hi</b>')
  })
})
