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

    const isFormData = (options?.body instanceof FormData)
    const headers = isFormData ? formDataHeaders : defaultHeaders
    const body = (isFormData ? options?.body : JSON.stringify(options?.body)) as BodyInit

    return fetch(`${replacedUrl}?${params.toString()}`, {
      method,
      headers,
      body,
    })
      .then(r => (r.ok ? (r.json() as Promise<TResult>) : Promise.reject(r)))
      .catch((e) => { throw e })
  }
}
