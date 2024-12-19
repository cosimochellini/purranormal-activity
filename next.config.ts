import { setupDevPlatform } from '@cloudflare/next-on-pages/next-dev'
import type { NextConfig } from 'next'

// eslint-disable-next-line node/prefer-global/process
if (process.env.NODE_ENV === 'development') {
  await setupDevPlatform()
}

const nextConfig: NextConfig = {
  /* config options here */
  experimental: {
    typedRoutes: true,
  },
}

export default nextConfig
