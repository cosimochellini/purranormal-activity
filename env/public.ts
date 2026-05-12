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

let warnedMissingAppUrl = false

const resolveAppUrl = () => {
  const baked = readPublicEnv('VITE_APP_URL')
  if (baked) return normalizeUrl(baked)

  const r2Host = readPublicEnv('VITE_CLOUDFLARE_PUBLIC_URL')
  if (r2Host) return normalizeUrl(`https://${r2Host}`)

  if (typeof globalThis !== 'undefined' && globalThis.location?.origin) {
    return normalizeUrl(globalThis.location.origin)
  }

  if (import.meta.env?.DEV) return DEFAULT_DEV_URL

  if (!warnedMissingAppUrl) {
    warnedMissingAppUrl = true
    console.warn(
      '[env/public] VITE_APP_URL and VITE_CLOUDFLARE_PUBLIC_URL are unset; falling back to relative URLs',
    )
  }
  return ''
}

export const VITE_APP_URL = resolveAppUrl()

export const APP_URL = VITE_APP_URL

export const VITE_CLOUDFLARE_PUBLIC_URL = readPublicEnv('VITE_CLOUDFLARE_PUBLIC_URL') || ''
