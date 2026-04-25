import { Buffer } from 'node:buffer'
import { describe, expect, it } from 'vitest'
import { mockFetchOnce, mockFetchReject } from '@/tests/helpers'
import { downloadImageAsBuffer, toAssetSrc } from './image'

describe('toAssetSrc', () => {
  it('returns the string when given a plain string asset', () => {
    expect(toAssetSrc('/foo.png')).toBe('/foo.png')
  })

  it('returns asset.src when given an object asset', () => {
    expect(toAssetSrc({ src: '/bar.svg' })).toBe('/bar.svg')
  })

  it('handles empty strings', () => {
    expect(toAssetSrc('')).toBe('')
    expect(toAssetSrc({ src: '' })).toBe('')
  })
})

describe('downloadImageAsBuffer', () => {
  it('returns a Buffer for a successful response', async () => {
    const bytes = new Uint8Array([0xde, 0xad, 0xbe, 0xef])
    mockFetchOnce(Buffer.from(bytes).toString(), { status: 200 })
    // Override the body bytes to match exactly
    const fetchMock = globalThis.fetch as ReturnType<typeof import('vitest').vi.fn>
    fetchMock.mockReset()
    fetchMock.mockResolvedValueOnce(new Response(bytes, { status: 200 }))

    const result = await downloadImageAsBuffer('https://example.com/img.png')
    expect(Buffer.isBuffer(result)).toBe(true)
    expect(result.equals(Buffer.from(bytes))).toBe(true)
  })

  it('throws when the response is not ok', async () => {
    mockFetchOnce({ error: 'nope' }, { status: 500 })
    await expect(downloadImageAsBuffer('https://example.com/missing.png')).rejects.toThrow(
      'Failed to fetch image from https://example.com/missing.png',
    )
  })

  it('propagates fetch rejections', async () => {
    mockFetchReject(new Error('network down'))
    await expect(downloadImageAsBuffer('https://example.com/x.png')).rejects.toThrow('network down')
  })
})
