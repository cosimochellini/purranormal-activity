import { getRequiredEnv } from './required'

export const TURSO_DATABASE_URL = getRequiredEnv('TURSO_DATABASE_URL')
export const TURSO_AUTH_TOKEN = getRequiredEnv('TURSO_AUTH_TOKEN')
