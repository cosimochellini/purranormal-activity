import { createServerFn } from '@tanstack/react-start'
import { getLog } from '@/services/log'

export const getLogById = createServerFn({ method: 'GET' })
  .inputValidator((data: { id: number }) => data)
  .handler(async ({ data }) => {
    return getLog(data.id)
  })
