const WORKERS_URL = 'https://purranormal-activity.workers.dev'

const normalizeUrl = (url: string) => url.replace(/\/$/, '')

export const VITE_APP_URL = normalizeUrl(process.env.VITE_APP_URL || WORKERS_URL)

export const APP_URL = VITE_APP_URL

export const VITE_CLOUDFLARE_PUBLIC_URL = process.env.VITE_CLOUDFLARE_PUBLIC_URL || ''

export const VITE_CLOUDFLARE_DEPLOY_URL =
  process.env.VITE_CLOUDFLARE_DEPLOY_URL || process.env.CLOUDFLARE_DEPLOY_URL || ''
