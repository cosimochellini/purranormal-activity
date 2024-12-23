import { setupDevPlatform } from '@cloudflare/next-on-pages/next-dev'
import type { NextConfig } from 'next'

// Here we use the @cloudflare/next-on-pages next-dev module to allow us to use bindings during local development
// (when running the application with `next dev`), for more information see:
// https://github.com/cloudflare/next-on-pages/blob/main/internal-packages/next-dev/README.md
// eslint-disable-next-line node/prefer-global/process
if (process.env.NODE_ENV === 'development') {
  await setupDevPlatform()
}

const nextConfig: NextConfig = {
  /* config options here */
  experimental: {
    typedRoutes: true,
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
}

export default nextConfig
