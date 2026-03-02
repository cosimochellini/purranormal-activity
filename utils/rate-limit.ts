import { time } from '@/utils/time'

interface RateLimitEntry {
  count: number
  resetAt: number
}

interface RateLimitOptions {
  namespace: string
  maxRequests: number
  windowMs?: number
}

interface RateLimitResult {
  allowed: boolean
  remaining: number
  retryAfterSeconds: number
}

const RATE_LIMIT_STORE_KEY = '__purranormal_rate_limit_store__'
const DEFAULT_WINDOW_MS = time({ minutes: 1 })

function getStore() {
  const globalStore = globalThis as typeof globalThis & {
    [RATE_LIMIT_STORE_KEY]?: Map<string, RateLimitEntry>
  }

  if (!globalStore[RATE_LIMIT_STORE_KEY]) {
    globalStore[RATE_LIMIT_STORE_KEY] = new Map<string, RateLimitEntry>()
  }

  return globalStore[RATE_LIMIT_STORE_KEY]
}

function getClientAddress(request: Request) {
  const cfIp = request.headers.get('cf-connecting-ip')
  if (cfIp) return cfIp

  const forwardedFor = request.headers.get('x-forwarded-for')
  if (forwardedFor) {
    return forwardedFor.split(',')[0]?.trim() || 'unknown'
  }

  return 'unknown'
}

export function applyRateLimit(request: Request, options: RateLimitOptions): RateLimitResult {
  const now = Date.now()
  const store = getStore()
  const windowMs = options.windowMs ?? DEFAULT_WINDOW_MS
  const clientAddress = getClientAddress(request)
  const key = `${options.namespace}:${clientAddress}`

  const currentEntry = store.get(key)

  if (!currentEntry || now >= currentEntry.resetAt) {
    store.set(key, {
      count: 1,
      resetAt: now + windowMs,
    })

    return {
      allowed: true,
      remaining: Math.max(options.maxRequests - 1, 0),
      retryAfterSeconds: 0,
    }
  }

  currentEntry.count += 1
  store.set(key, currentEntry)

  const allowed = currentEntry.count <= options.maxRequests
  const retryAfterSeconds = allowed ? 0 : Math.ceil((currentEntry.resetAt - now) / 1000)

  return {
    allowed,
    remaining: Math.max(options.maxRequests - currentEntry.count, 0),
    retryAfterSeconds,
  }
}
