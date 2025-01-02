import { typedObjectEntries } from './typed'

type Methods = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'

const headers = {
  'Content-Type': 'application/json',
}
interface FetchOptions< TQuery extends Record<string, string> = never, TBody = never> {
  query?: TQuery
  body?: TBody
  params?: Record<string, string | null | number>
}

export function fetcher<TResult, TQuery extends Record<string, string> = never, TBody = never>(url: string, method?: Methods) {
  return async (options?: FetchOptions<TQuery, TBody>) => {
    const replacedUrl = typedObjectEntries(options?.params ?? {})
      .reduce((curr, [key, value]) => curr.replaceAll(`[${key}]`, value?.toString() ?? ''), url)

    return fetch(`${replacedUrl}?${new URLSearchParams(options?.query).toString()}`, {
      method,
      headers,
      body: JSON.stringify(options?.body),
    })
      .then(r => (r.ok ? (r.json() as Promise<TResult>) : Promise.reject(r)))
      .catch((e) => { throw e })
  }
}
