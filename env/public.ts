const DEFAULT_DEV_URL = 'http://localhost:5173'

const normalizeUrl = (url: string) => url.replace(/\/$/, '')

type PublicEnvKey = 'VITE_APP_URL' | 'VITE_CLOUDFLARE_PUBLIC_URL'

function readPublicEnv(key: PublicEnvKey) {
  const fromVite = import.meta.env?.[key]
  if (fromVite) return fromVite

  if (typeof process !== 'undefined') {
    const fromProcess = process.env?.[key]
    if (fromProcess) return fromProcess
  }

  return undefined
}

const resolveAppUrl = () => {
  const appUrl = readPublicEnv('VITE_APP_URL') || readPublicEnv('VITE_CLOUDFLARE_PUBLIC_URL')

  if (appUrl) {
    return normalizeUrl(appUrl)
  }

  if (import.meta.env?.DEV) {
    return DEFAULT_DEV_URL
  }

  throw new Error('Missing VITE_APP_URL or VITE_CLOUDFLARE_PUBLIC_URL for production runtime')
}

export const VITE_APP_URL = resolveAppUrl()

export const APP_URL = VITE_APP_URL

export const VITE_CLOUDFLARE_PUBLIC_URL = readPublicEnv('VITE_CLOUDFLARE_PUBLIC_URL') || ''
