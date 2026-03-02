import { StatusCode } from '@/utils/http'
import { typedObjectEntries } from './typed'

type Methods = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'

const defaultHeaders = {
  'Content-Type': 'application/json',
}
const formDataHeaders = {}
const DEFAULT_TIMEOUT_MS = 20_000

type QueryValues = string | null | number | undefined | QueryValues[]

interface FetchOptions<TQuery extends Record<string, QueryValues> = never, TBody = never> {
  query?: Record<keyof TQuery, QueryValues>
  body?: TBody
  params?: Record<string, string | null | number>
  timeoutMs?: number
  signal?: AbortSignal
}

interface JsonWithFlags {
  success?: boolean
  ok?: boolean
  error?: string
  message?: string
}

function hasApiFlags(value: unknown): value is JsonWithFlags {
  if (!value || typeof value !== 'object') return false

  return 'success' in value || 'ok' in value
}

async function parseBody(response: Response) {
  if (response.status === StatusCode.NoContent || response.status === StatusCode.ResetContent) {
    return null
  }

  const contentType = response.headers.get('content-type') || ''

  if (contentType.includes('application/json')) {
    return response.json()
  }

  const text = await response.text()
  return text || null
}

function createUrl(url: string, query?: Record<string, QueryValues>) {
  const params = new URLSearchParams(
    typedObjectEntries(query ?? ({} as Record<string, QueryValues>)).map(([key, value]) => [
      key,
      value?.toString() ?? '',
    ]),
  ).toString()

  if (!params) return url
  return `${url}?${params}`
}

export function fetcher<TResult, TQuery extends Record<string, QueryValues> = never, TBody = never>(
  url: string,
  method?: Methods,
) {
  return async (options?: FetchOptions<TQuery, TBody>) => {
    const replacedUrl = typedObjectEntries(options?.params ?? {}).reduce(
      (curr, [key, value]) => curr.replaceAll(`[${key}]`, value?.toString() ?? ''),
      url,
    )

    const isFormData = options?.body instanceof FormData
    const headers = isFormData ? formDataHeaders : defaultHeaders
    const shouldHaveBody = method && method !== 'GET'
    const body = shouldHaveBody
      ? ((isFormData ? options?.body : JSON.stringify(options?.body)) as BodyInit)
      : undefined

    const controller = new AbortController()
    const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS
    const timeoutId = setTimeout(() => controller.abort('Request timed out'), timeoutMs)

    if (options?.signal) {
      options.signal.addEventListener('abort', () => controller.abort(options.signal?.reason), {
        once: true,
      })
    }

    try {
      const response = await fetch(createUrl(replacedUrl, options?.query), {
        method,
        headers,
        body,
        signal: controller.signal,
      })

      const parsedBody = await parseBody(response)

      if (!response.ok) {
        if (hasApiFlags(parsedBody)) {
          return parsedBody as TResult
        }

        const message =
          (typeof parsedBody === 'object' &&
            parsedBody &&
            'error' in parsedBody &&
            typeof parsedBody.error === 'string' &&
            parsedBody.error) ||
          (typeof parsedBody === 'string' ? parsedBody : null) ||
          `HTTP ${response.status}`

        throw new Error(message)
      }

      return parsedBody as TResult
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`Request timed out after ${timeoutMs}ms`)
      }

      throw error
    } finally {
      clearTimeout(timeoutId)
    }
  }
}
