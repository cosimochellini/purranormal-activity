/* eslint-disable node/prefer-global/process */

/**
 * Single server-only env surface. All reads are LAZY (getter accessors) so
 * `process.env` is never touched at module load — required for Cloudflare
 * Workers, where module evaluation predates the per-request env binding.
 *
 * Replaces the per-category modules (`env/db`, `env/openai`, `env/secret`,
 * `env/cloudflare`, `env/telegram`, `env/package`, `env/required`). The
 * sibling `env/public.ts` stays separate — it targets the browser bundle
 * via Vite's `import.meta.env` and intentionally never reads `process.env`.
 */
import { logger } from '@/utils/logger'

const required = (key: string): string => {
  const v = process.env?.[key]
  if (!v) throw new Error(`Missing required env: ${key}`)
  return v
}

const warnOptional = (key: string, fallback = ''): string => {
  const v = process.env?.[key]
  if (!v) logger.warn(`[env] ${key} unset`)
  return v ?? fallback
}

export const serverEnv = {
  get tursoUrl() {
    return required('TURSO_DATABASE_URL')
  },
  get tursoToken() {
    return required('TURSO_AUTH_TOKEN')
  },
  get openaiApiKey() {
    return required('OPENAI_API_KEY')
  },
  get accessKeyId() {
    return required('ACCESS_KEY_ID')
  },
  get secretAccessKey() {
    return required('SECRET_ACCESS_KEY')
  },
  get accountId() {
    return required('ACCOUNT_ID')
  },
  get secret() {
    return required('SECRET')
  },
  get telegramApiKey() {
    return warnOptional('TELEGRAM_BOT_API_KEY')
  },
  get telegramChatIds() {
    return warnOptional('TELEGRAM_BOT_CHAT_IDS')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
  },
  get version() {
    return process.env.npm_package_version ?? ''
  },
}

export const bucket = {
  name: 'purranormal-images' as const,
  get url() {
    return `https://${serverEnv.accountId}.r2.cloudflarestorage.com`
  },
}
