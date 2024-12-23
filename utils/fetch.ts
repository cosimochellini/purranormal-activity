type Methods = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'

const headers = {
  'Content-Type': 'application/json',
}

export function fetcher<TResult, TQuery extends Record<string, string> = never, TBody = never>(url: string, method?: Methods) {
  return async (options?: { query?: TQuery, body?: TBody }) =>
    fetch(`${url}?${new URLSearchParams(options?.query).toString()}`, {
      method,
      headers,
      body: JSON.stringify(options?.body),
    })
      .then(r => (r.ok ? (r.json() as Promise<TResult>) : Promise.reject(r)))
      .catch((e) => { throw e })
}
