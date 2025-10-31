import { CLOUDFLARE_PUBLIC_URL } from '@/env/cloudflare'

// Lightweight client-safe utilities
// Heavy operations (AWS SDK) are in cloudflare.server.ts

export const publicImage = (id: number) =>
  `https://${CLOUDFLARE_PUBLIC_URL}/${id}/cover.webp` as const

// For heavy operations like uploadToR2, deleteFromR2, etc.
// Import from './cloudflare.server' in API routes only
