import type { GetResponse } from '../app/api/categories/route'
import { NEXT_PUBLIC_APP_URL } from '../env/next'
import { fetcher } from '../utils/fetch'

export const getCategories = fetcher<GetResponse>(`${NEXT_PUBLIC_APP_URL}/api/categories`)()
