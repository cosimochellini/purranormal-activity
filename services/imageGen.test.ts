import { beforeEach, describe, expect, it, vi } from 'vitest'

const { generateImage } = vi.hoisted(() => ({
  generateImage: vi.fn(async () => ({ images: [] })),
}))

vi.mock('ai', () => ({ generateImage }))
vi.mock('@ai-sdk/openai', () => {
  const fn = vi.fn((id: string) => ({ id }))
  Object.assign(fn, { image: vi.fn((id: string) => ({ image: id })) })
  return { openai: fn }
})

import { generateImageBase64 } from './imageGen'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('generateImageBase64', () => {
  it('returns the base64 string from the first image', async () => {
    generateImage.mockResolvedValueOnce({
      images: [{ base64: 'AAA' }],
    } as never)
    const result = await generateImageBase64('a prompt')
    expect(result).toBe('AAA')
  })

  it("throws 'Image generation failed' when the model returns no image", async () => {
    generateImage.mockResolvedValueOnce({ images: [] } as never)
    await expect(generateImageBase64('a prompt')).rejects.toThrow('Image generation failed')
  })

  it("throws 'Image generation failed' when the model rejects", async () => {
    generateImage.mockRejectedValueOnce(new Error('quota exceeded'))
    await expect(generateImageBase64('a prompt')).rejects.toThrow('Image generation failed')
  })
})
