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
    minimumCacheTTL: 60 * 60 * 24 * 7, // 7 days
    deviceSizes: [320, 420, 768, 1024, 1200],
    imageSizes: [16, 32, 48, 64, 96, 128, 256],
  },
  poweredByHeader: false,
  compress: true,

  experimental: {
    optimizePackageImports: ['@tabler/icons-react', 'drizzle-orm'],
  },

  // Empty turbopack config to silence warning, we'll optimize in other ways
  turbopack: {},
}

export default nextConfig
