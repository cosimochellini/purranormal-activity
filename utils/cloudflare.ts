import { CLOUDFLARE_DEPLOY_URL, CLOUDFLARE_PUBLIC_URL } from '../env/cloudflare'

export const publicImage = (id: number) => `https://${CLOUDFLARE_PUBLIC_URL}/${id}/cover.webp` as const

export const redeploy = () => fetch(CLOUDFLARE_DEPLOY_URL, { method: 'POST' })
