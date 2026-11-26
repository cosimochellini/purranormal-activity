import { createServerFn } from '@tanstack/react-start'
import { getLog } from '@/services/log'
import { logger } from '@/utils/logger'

export const getLogById = createServerFn({ method: 'GET' })
  .validator((data: { id: number }) => data)
  .handler(async ({ data }) => {
    try {
      return await getLog(data.id)
    } catch (error) {
      logger.error(`Failed to load log ${data.id}:`, error)
      return null
    }
  })
