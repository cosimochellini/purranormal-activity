import { getRequiredEnv } from './required'

export const ACCOUNT_ID = getRequiredEnv('ACCOUNT_ID')

export const ACCESS_KEY_ID = getRequiredEnv('ACCESS_KEY_ID')

export const SECRET_ACCESS_KEY = getRequiredEnv('SECRET_ACCESS_KEY')

export const BUCKET_NAME = 'purranormal-images'

export const BUCKET_URL = `https://${ACCOUNT_ID}.r2.cloudflarestorage.com` as const

export const CLOUDFLARE_IMAGE_TOKEN = getRequiredEnv('CLOUDFLARE_IMAGE_TOKEN')
