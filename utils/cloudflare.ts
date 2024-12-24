import { CLOUDFLARE_PUBLIC_URL } from '../env/cloudflare'

export const publicImage = (id: number) => `https://${CLOUDFLARE_PUBLIC_URL}/${id}/cover.webp` as const
