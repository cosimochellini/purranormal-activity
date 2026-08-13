import { beforeEach, describe, expect, it, vi } from 'vitest'
import { logger } from '@/utils/logger'

// The R2 write surface is a factory over a bucket accessor, so the boundary is
// mocked by handing `createR2ImageStore` a plain fake instead of stubbing a
// module. Nothing here touches `cloudflare:workers` — that binding is wired up
// only in `r2.server.ts`.
vi.mock('@/env/public', () => ({
  VITE_APP_URL: 'http://localhost:5173',
  APP_URL: 'http://localhost:5173',
  VITE_CLOUDFLARE_PUBLIC_URL: 'images.example.com',
}))

import { publicUrl } from './index'
import { createR2ImageStore } from './r2'

const put = vi.fn(async () => ({}))
const del = vi.fn(async () => undefined)

// There is no bucket *name* in any assertion below: with a binding, the bucket
// identity lives in `wrangler.jsonc`, not in the call.
const fakeBucket = { put, delete: del } as unknown as R2Bucket
const imageStore = createR2ImageStore(() => fakeBucket)

beforeEach(() => {
  put.mockReset()
  put.mockImplementation(async () => ({}))
  del.mockReset()
  del.mockImplementation(async () => undefined)
})

describe('imageStore.put', () => {
  it('writes the configured key with the raw bytes and image/webp content type', async () => {
    await imageStore.put(99, new Uint8Array([1, 2, 3]))

    expect(put).toHaveBeenCalledTimes(1)
    const [key, body, options] = put.mock.calls[0] as unknown as [
      string,
      Uint8Array,
      { httpMetadata: { contentType: string } },
    ]
    expect(key).toBe('99/cover.webp')
    expect(options).toEqual({ httpMetadata: { contentType: 'image/webp' } })
    // `R2Bucket.put` takes an `ArrayBufferView`, so no Buffer wrapping.
    expect(body).toBeInstanceOf(Uint8Array)
    expect(Array.from(body)).toEqual([1, 2, 3])
  })

  it('wraps R2 errors with the documented `R2 upload failed:` prefix', async () => {
    put.mockRejectedValueOnce(new Error('r2 down'))
    await expect(imageStore.put(1, new Uint8Array([0]))).rejects.toThrow(
      'R2 upload failed: r2 down',
    )
    expect(vi.mocked(logger.error)).toHaveBeenCalledWith(
      'Error uploading to R2:',
      expect.any(Error),
    )
  })

  it('stringifies non-Error rejections into the same prefix', async () => {
    put.mockRejectedValueOnce({ code: 'nope' })
    await expect(imageStore.put(1, new Uint8Array([0]))).rejects.toThrow(
      'R2 upload failed: {"code":"nope"}',
    )
  })
})

describe('imageStore.delete', () => {
  it('deletes the configured key', async () => {
    await imageStore.delete(7)

    expect(del).toHaveBeenCalledWith('7/cover.webp')
  })

  it('wraps R2 errors with the generic delete-failed message', async () => {
    del.mockRejectedValueOnce(new Error('boom'))
    await expect(imageStore.delete(7)).rejects.toThrow('Failed to delete object from R2')
    expect(vi.mocked(logger.error)).toHaveBeenCalledWith(
      'Error deleting object from R2:',
      expect.any(Error),
    )
  })
})

describe('publicUrl', () => {
  it('returns the canonical R2 URL for a given id', () => {
    expect(publicUrl(42)).toBe('https://images.example.com/42/cover.webp')
    expect(publicUrl(0)).toBe('https://images.example.com/0/cover.webp')
    expect(publicUrl(123456)).toBe('https://images.example.com/123456/cover.webp')
  })
})

describe('publicUrl with empty VITE_CLOUDFLARE_PUBLIC_URL', () => {
  it('returns an empty string when the env value is empty', async () => {
    vi.resetModules()
    vi.doMock('@/env/public', () => ({
      VITE_APP_URL: 'http://localhost:5173',
      APP_URL: 'http://localhost:5173',
      VITE_CLOUDFLARE_PUBLIC_URL: '',
    }))
    const { publicUrl: rebuilt } = await import('./index')
    expect(rebuilt(7)).toBe('')
    vi.doUnmock('@/env/public')
    vi.resetModules()
  })
})
