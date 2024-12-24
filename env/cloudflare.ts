/* eslint-disable node/prefer-global/process */
export const ACCOUNT_ID = process.env.ACCOUNT_ID as string

export const ACCESS_KEY_ID = process.env.ACCESS_KEY_ID as string

export const SECRET_ACCESS_KEY = process.env.SECRET_ACCESS_KEY as string

export const BUCKET_NAME = 'purranormal-images'

export const BUCKET_URL = `https://${ACCOUNT_ID}.r2.cloudflarestorage.com` as const

export const CLOUDFLARE_PUBLIC_URL = process.env.CLOUDFLARE_PUBLIC_URL as string
