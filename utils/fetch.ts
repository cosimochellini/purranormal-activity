import { typedObjectEntries } from './typed'

type Methods = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'

const headers = {
  'Content-Type': 'application/json',
}
type QueryValues = string | null | number | undefined | QueryValues[]

interface FetchOptions<TQuery extends Record<string, QueryValues> = never, TBody = never> {
  query?: Record<keyof TQuery, QueryValues>
  body?: TBody
  params?: Record<string, string | null | number>
}

export function fetcher<
  TResult,
  TQuery extends Record<string, QueryValues> = never,
  TBody = never,
>(url: string, method?: Methods) {
  return async (options?: FetchOptions<TQuery, TBody>) => {
    const replacedUrl = typedObjectEntries(options?.params ?? {})
      .reduce((curr, [key, value]) => curr.replaceAll(`[${key}]`, value?.toString() ?? ''), url)

    const params = new URLSearchParams(
      typedObjectEntries(options?.query ?? {} as Record<string, QueryValues>)
        .map(([key, value]) => [key, value?.toString() ?? '']),
    )

    return fetch(`${replacedUrl}?${params.toString()}`, {
      method,
      headers,
      body: JSON.stringify(options?.body),
    })
      .then(r => (r.ok ? (r.json() as Promise<TResult>) : Promise.reject(r)))
      .catch((e) => { throw e })
  }
}
