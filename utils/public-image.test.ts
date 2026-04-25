import { describe, expect, it, vi } from 'vitest'

vi.mock('@/env/public', () => ({
  VITE_APP_URL: 'http://localhost:5173',
  APP_URL: 'http://localhost:5173',
  VITE_CLOUDFLARE_PUBLIC_URL: 'images.example.com',
}))

describe('publicImage', () => {
  it('builds the cover URL using the configured public URL', async () => {
    const { publicImage } = await import('./public-image')
    expect(publicImage(42)).toBe('https://images.example.com/42/cover.webp')
  })

  it('returns the same URL shape for any numeric id', async () => {
    const { publicImage } = await import('./public-image')
    expect(publicImage(0)).toBe('https://images.example.com/0/cover.webp')
    expect(publicImage(123456)).toBe('https://images.example.com/123456/cover.webp')
  })
})

describe('publicImage with empty VITE_CLOUDFLARE_PUBLIC_URL', () => {
  it('returns an empty string when the env value is empty', async () => {
    vi.resetModules()
    vi.doMock('@/env/public', () => ({
      VITE_APP_URL: 'http://localhost:5173',
      APP_URL: 'http://localhost:5173',
      VITE_CLOUDFLARE_PUBLIC_URL: '',
    }))
    const { publicImage } = await import('./public-image')
    expect(publicImage(7)).toBe('')
    vi.doUnmock('@/env/public')
    vi.resetModules()
  })
})
