import type { AnyRouteMatch } from '@tanstack/react-router'
import { getActiveRouter } from '@/start/router'
import { matchesTags, parseInvalidateHeader } from './invalidation'
import { logger } from './logger'
import { typedObjectEntries } from './typed'

type Methods = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'

const defaultHeaders = {
  'Content-Type': 'application/json',
}
const formDataHeaders = {}

type QueryValues = string | null | number | undefined | QueryValues[]

interface FetchOptions<TQuery extends Record<string, QueryValues> = never, TBody = never> {
  query?: Record<keyof TQuery, QueryValues>
  body?: TBody
  params?: Record<string, string | null | number>
  signal?: AbortSignal
}

async function applyInvalidation(response: Response): Promise<void> {
  const tags = parseInvalidateHeader(response.headers.get('X-Invalidate'))
  if (tags.length === 0) return

  const router = getActiveRouter()
  if (!router) return

  try {
    await router.invalidate({
      filter: (match: AnyRouteMatch) => matchesTags(match, tags),
    })
  } catch (error) {
    logger.error('Failed to apply X-Invalidate:', error)
  }
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

    const params = new URLSearchParams(
      typedObjectEntries(options?.query ?? ({} as Record<string, QueryValues>)).map(
        ([key, value]) => [key, value?.toString() ?? ''],
      ),
    )

    const isFormData = options?.body instanceof FormData
    const headers = isFormData ? formDataHeaders : defaultHeaders
    const body = (isFormData ? options?.body : JSON.stringify(options?.body)) as BodyInit

    const response = await fetch(`${replacedUrl}?${params.toString()}`, {
      method,
      headers,
      body,
      signal: options?.signal,
    })

    if (!response.ok) {
      throw response
    }

    await applyInvalidation(response)

    return (await response.json()) as TResult
  }
}
