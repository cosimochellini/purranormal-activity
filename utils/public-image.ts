import { VITE_CLOUDFLARE_PUBLIC_URL } from '@/env/public'

export function publicImage(id: number) {
  if (!VITE_CLOUDFLARE_PUBLIC_URL) return ''

  return `https://${VITE_CLOUDFLARE_PUBLIC_URL}/${id}/cover.webp` as const
}
