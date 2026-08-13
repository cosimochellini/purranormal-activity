import { VITE_CLOUDFLARE_PUBLIC_URL } from '@/env/public'

/**
 * Client-safe half of the image store: the key scheme and the public read URL.
 * Anything that renders — components, route `head` meta, the Telegram
 * notifier — imports from here.
 *
 * Writes live in the sibling `r2.server.ts`, which touches the `IMAGES` R2
 * binding and is therefore server-only. Keeping the default entrypoint
 * browser-safe means the binding can never be dragged into the client bundle
 * by accident.
 */

// Single key-scheme constant: rename = one edit. Shared with the writer.
export const objectKey = (id: number) => `${id}/cover.webp` as const

export const publicUrl = (id: number) => {
  if (!VITE_CLOUDFLARE_PUBLIC_URL) return ''
  return `https://${VITE_CLOUDFLARE_PUBLIC_URL}/${objectKey(id)}`
}
