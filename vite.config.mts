import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { cloudflare } from '@cloudflare/vite-plugin'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const rootDir = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  resolve: {
    alias: {
      '@': rootDir,
    },
  },
  plugins: [
    cloudflare({ viteEnvironment: { name: 'ssr' } }),
    tanstackStart({
      srcDirectory: 'start',
      // Import protection is what keeps `services/imageStore/r2.server.ts`
      // (and its `cloudflare:workers` import) out of the client bundle.
      // Without an explicit `include`, the gate defaults to
      // `isInsideDirectory(file, srcDirectory)` — i.e. `start/` only — so the
      // `**/*.server.*` client rule would never fire for a file under
      // `services/`.
      importProtection: {
        include: ['start/**', 'services/**'],
      },
    }),
    react(),
  ],
})
