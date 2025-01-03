import type { NextConfig } from 'next'
import { CLOUDFLARE_PUBLIC_URL } from './env/cloudflare'

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
  poweredByHeader: false,
  compress: true,

  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
}

export default nextConfig
