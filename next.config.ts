import type { NextConfig } from 'next'
import { CLOUDFLARE_PUBLIC_URL } from './env/cloudflare'

// Here we use the @cloudflare/next-on-pages next-dev module to allow us to use bindings during local development
// (when running the application with `next dev`), for more information see:
// https://github.com/cloudflare/next-on-pages/blob/main/internal-packages/next-dev/README.md
// eslint-disable-next-line node/prefer-global/process
if (process.env.NODE_ENV === 'development') {
//   await setupDevPlatform()
}

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: CLOUDFLARE_PUBLIC_URL,
        port: '',
        search: '',
      },
    ],
  },
}

export default nextConfig
