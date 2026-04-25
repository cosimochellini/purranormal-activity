import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mockFetchOnce } from '@/tests/helpers'
import { fetcher } from './fetch'

describe('fetcher', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('builds a GET request with no body and an empty query string', async () => {
    mockFetchOnce({ ok: true, value: 1 })
    const get = fetcher<{ ok: boolean; value: number }>('https://api.example.com/users', 'GET')
    const result = await get()

    expect(result).toEqual({ ok: true, value: 1 })
    const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [calledUrl, init] = fetchMock.mock.calls[0]
    expect(calledUrl).toBe('https://api.example.com/users?')
    expect(init.method).toBe('GET')
    expect(init.headers).toEqual({ 'Content-Type': 'application/json' })
    expect(init.body).toBe(JSON.stringify(undefined))
  })

  it('serializes JSON bodies and sets the JSON Content-Type', async () => {
    mockFetchOnce({ id: 1 })
    const post = fetcher<{ id: number }, never, { name: string }>(
      'https://api.example.com/users',
      'POST',
    )
    await post({ body: { name: 'Alice' } })

    const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>
    const [, init] = fetchMock.mock.calls[0]
    expect(init.method).toBe('POST')
    expect(init.headers).toEqual({ 'Content-Type': 'application/json' })
    expect(init.body).toBe(JSON.stringify({ name: 'Alice' }))
  })

  it('serializes query parameters', async () => {
    mockFetchOnce({})
    const get = fetcher<unknown, { q: string; page: number }>(
      'https://api.example.com/search',
      'GET',
    )
    await get({ query: { q: 'cats', page: 2 } })

    const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>
    const [calledUrl] = fetchMock.mock.calls[0]
    expect(calledUrl).toBe('https://api.example.com/search?q=cats&page=2')
  })

  it('replaces [param] tokens via the params option', async () => {
    mockFetchOnce({})
    const get = fetcher('https://api.example.com/users/[id]/posts/[postId]', 'GET')
    await get({ params: { id: 42, postId: 'abc' } })

    const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>
    const [calledUrl] = fetchMock.mock.calls[0]
    expect(calledUrl).toBe('https://api.example.com/users/42/posts/abc?')
  })

  it('passes through an AbortSignal on the underlying fetch call', async () => {
    mockFetchOnce({})
    const controller = new AbortController()
    const get = fetcher('https://api.example.com/x', 'GET')
    await get({ signal: controller.signal })

    const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>
    const [, init] = fetchMock.mock.calls[0]
    expect(init.signal).toBe(controller.signal)
  })

  it('uses empty headers and raw FormData body when given FormData', async () => {
    mockFetchOnce({})
    const fd = new FormData()
    fd.append('foo', 'bar')

    const post = fetcher<unknown, never, FormData>('https://api.example.com/upload', 'POST')
    await post({ body: fd })

    const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>
    const [, init] = fetchMock.mock.calls[0]
    expect(init.headers).toEqual({})
    expect(init.body).toBe(fd)
  })

  it('rejects with the Response when r.ok is false', async () => {
    mockFetchOnce({ error: 'bad' }, { status: 500 })
    const get = fetcher('https://api.example.com/x', 'GET')

    await expect(get()).rejects.toBeInstanceOf(Response)
  })

  it('handles missing options object (defaults applied)', async () => {
    mockFetchOnce({ done: true })
    const get = fetcher<{ done: boolean }>('https://api.example.com/ping', 'GET')
    const result = await get()
    expect(result).toEqual({ done: true })
  })

  it('replaces a [param] with empty string when the value is null', async () => {
    mockFetchOnce({})
    const get = fetcher('https://api.example.com/users/[id]', 'GET')
    await get({ params: { id: null as unknown as number } })

    const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>
    const [calledUrl] = fetchMock.mock.calls[0]
    expect(calledUrl).toBe('https://api.example.com/users/?')
  })
})
