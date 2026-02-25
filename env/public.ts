const WORKERS_URL = 'https://purranormal-activity.workers.dev'

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

export const VITE_APP_URL = normalizeUrl(readPublicEnv('VITE_APP_URL') || WORKERS_URL)

export const APP_URL = VITE_APP_URL

export const VITE_CLOUDFLARE_PUBLIC_URL = readPublicEnv('VITE_CLOUDFLARE_PUBLIC_URL') || ''
