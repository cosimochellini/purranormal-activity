import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { cloudflare } from '@cloudflare/vite-plugin'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const rootDir = path.dirname(fileURLToPath(import.meta.url))
const { version } = JSON.parse(readFileSync(path.join(rootDir, 'package.json'), 'utf8'))

export default defineConfig({
  // Build-time constants (see `vite-env.d.ts`). The build id keys the SSR edge
  // cache so a page cached before a deploy never points at retired assets.
  define: {
    __APP_VERSION__: JSON.stringify(version),
    __BUILD_ID__: JSON.stringify(Date.now().toString(36)),
  },
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
